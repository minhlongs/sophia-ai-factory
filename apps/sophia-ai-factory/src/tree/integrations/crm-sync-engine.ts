/**
 * Enterprise CRM Bi-directional Sync Engine
 *
 * Implements:
 * - Salesforce Opportunity & HubSpot Deal two-way adapters.
 * - Deterministic stage & value (cents <-> decimal) conversions.
 * - Last-Write-Wins (LWW) conflict resolution with Sophia authority bias
 *   on closed enterprise contracts.
 * - D1 persistence for CRM configurations and sync events.
 *
 * Layer: tree/integrations (Pure domain engine — imports only from @/seed and @/tree/)
 *
 * @module tree/integrations/crm-sync-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  CrmProvider,
  EnterpriseCrmConfig,
  EnterpriseCrmConfigRow,
  UpsertCrmConfigInput,
  CrmSyncEvent,
  CrmSyncEventRow,
  RecordCrmSyncEventInput,
  CrmSyncStatus,
  SophiaDealStage,
  SophiaDealSnapshot,
  SalesforceOpportunityPayload,
  HubSpotDealPayload,
  ConflictResolutionOptions,
  ConflictResolutionResult,
} from './types';
import {
  mapCrmConfigRow,
  mapCrmSyncEventRow,
} from './types';

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

// ── Stage Conversion Maps ───────────────────────────────────────────────────

export const SOPHIA_TO_SALESFORCE_STAGE_MAP: Record<SophiaDealStage, string> = {
  new_lead: 'Prospecting',
  enriching: 'Prospecting',
  qualified: 'Qualification',
  demo_prepared: 'Needs Analysis',
  demo_active: 'Value Proposition',
  proposal_sent: 'Proposal/Price Quote',
  negotiating: 'Proposal/Price Quote',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export const SALESFORCE_TO_SOPHIA_STAGE_MAP: Record<string, SophiaDealStage> = {
  Prospecting: 'new_lead',
  Qualification: 'qualified',
  'Needs Analysis': 'demo_prepared',
  'Value Proposition': 'demo_active',
  'Proposal/Price Quote': 'proposal_sent',
  'Negotiation/Review': 'negotiating',
  'Closed Won': 'closed_won',
  'Closed Lost': 'closed_lost',
};

export const SOPHIA_TO_HUBSPOT_STAGE_MAP: Record<SophiaDealStage, string> = {
  new_lead: 'appointmentscheduled',
  enriching: 'appointmentscheduled',
  qualified: 'qualifiedtobuy',
  demo_prepared: 'presentationscheduled',
  demo_active: 'decisionmakerboughtin',
  proposal_sent: 'contractsent',
  negotiating: 'contractsent',
  closed_won: 'closedwon',
  closed_lost: 'closedlost',
};

export const HUBSPOT_TO_SOPHIA_STAGE_MAP: Record<string, SophiaDealStage> = {
  appointmentscheduled: 'new_lead',
  qualifiedtobuy: 'qualified',
  presentationscheduled: 'demo_prepared',
  decisionmakerboughtin: 'demo_active',
  contractsent: 'proposal_sent',
  closedwon: 'closed_won',
  closedlost: 'closed_lost',
};

// ── Adapter Transformations ─────────────────────────────────────────────────

/**
 * Converts Sophia deal value in cents to decimal amount.
 * Example: 150000 cents -> 1500.00
 */
export function centsToDecimalAmount(valueCents: number): number {
  if (!Number.isFinite(valueCents) || valueCents <= 0) return 0;
  return Math.round(valueCents) / 100.0;
}

/**
 * Converts external decimal amount to Sophia integer cents.
 * Example: 1500.50 -> 150050 cents
 */
export function decimalAmountToCents(amount: number | string | undefined | null): number {
  if (amount === undefined || amount === null) return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num * 100);
}

/**
 * Transforms a Sophia deal into a Salesforce Opportunity payload.
 */
export function transformSophiaToSalesforce(deal: SophiaDealSnapshot): SalesforceOpportunityPayload {
  const sfStage = SOPHIA_TO_SALESFORCE_STAGE_MAP[deal.dealStage] || 'Prospecting';
  const truncatedName = (deal.companyName ? `${deal.companyName} - Enterprise AI` : 'Enterprise Deal').slice(0, 120);

  return {
    Sophia_Deal_Id__c: deal.id,
    Name: truncatedName,
    StageName: sfStage,
    Amount: centsToDecimalAmount(deal.dealValueEstimateCents),
    CurrencyIsoCode: deal.currency || 'USD',
    CloseDate: deal.closeDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    Description: deal.notes || undefined,
    Contact_Email__c: deal.leadEmail || undefined,
    Contact_Phone__c: deal.leadPhone || undefined,
    Account_Domain__c: deal.companyDomain,
  };
}

/**
 * Transforms a Salesforce Opportunity payload into a partial Sophia deal.
 */
export function transformSalesforceToSophia(sfOpp: SalesforceOpportunityPayload): Partial<SophiaDealSnapshot> {
  const sophiaStage = SALESFORCE_TO_SOPHIA_STAGE_MAP[sfOpp.StageName] || 'new_lead';
  const dealValueCents = decimalAmountToCents(sfOpp.Amount);

  const partial: Partial<SophiaDealSnapshot> = {
    dealStage: sophiaStage,
    dealValueEstimateCents: dealValueCents,
    currency: sfOpp.CurrencyIsoCode || 'USD',
  };

  if (sfOpp.Sophia_Deal_Id__c) partial.id = sfOpp.Sophia_Deal_Id__c;
  if (sfOpp.Account_Domain__c) partial.companyDomain = sfOpp.Account_Domain__c;
  if (sfOpp.Contact_Email__c) partial.leadEmail = sfOpp.Contact_Email__c;
  if (sfOpp.Contact_Phone__c) partial.leadPhone = sfOpp.Contact_Phone__c;
  if (sfOpp.Description) partial.notes = sfOpp.Description;
  if (sfOpp.CloseDate) partial.closeDate = sfOpp.CloseDate;

  return partial;
}

/**
 * Transforms a Sophia deal into a HubSpot Deal payload.
 */
export function transformSophiaToHubSpot(deal: SophiaDealSnapshot): HubSpotDealPayload {
  const hsStage = SOPHIA_TO_HUBSPOT_STAGE_MAP[deal.dealStage] || 'appointmentscheduled';
  const truncatedName = (deal.companyName ? `${deal.companyName} - Enterprise AI` : 'Enterprise Deal').slice(0, 120);

  return {
    sophia_deal_id: deal.id,
    dealname: truncatedName,
    dealstage: hsStage,
    amount: centsToDecimalAmount(deal.dealValueEstimateCents),
    deal_currency_code: deal.currency || 'USD',
    closedate: deal.closeDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    description: deal.notes || undefined,
    contact_email: deal.leadEmail || undefined,
    contact_phone: deal.leadPhone || undefined,
    company_domain: deal.companyDomain,
  };
}

/**
 * Transforms a HubSpot Deal payload into a partial Sophia deal.
 */
export function transformHubSpotToSophia(hsDeal: HubSpotDealPayload): Partial<SophiaDealSnapshot> {
  const sophiaStage = HUBSPOT_TO_SOPHIA_STAGE_MAP[hsDeal.dealstage] || 'new_lead';
  const dealValueCents = decimalAmountToCents(hsDeal.amount);

  let closeDateStr: string | undefined = undefined;
  if (typeof hsDeal.closedate === 'string') {
    closeDateStr = hsDeal.closedate.split('T')[0];
  } else if (typeof hsDeal.closedate === 'number') {
    closeDateStr = new Date(hsDeal.closedate).toISOString().split('T')[0];
  }

  const partial: Partial<SophiaDealSnapshot> = {
    dealStage: sophiaStage,
    dealValueEstimateCents: dealValueCents,
    currency: hsDeal.deal_currency_code || 'USD',
  };

  if (hsDeal.sophia_deal_id) partial.id = hsDeal.sophia_deal_id;
  if (hsDeal.company_domain) partial.companyDomain = hsDeal.company_domain;
  if (hsDeal.contact_email) partial.leadEmail = hsDeal.contact_email;
  if (hsDeal.contact_phone) partial.leadPhone = hsDeal.contact_phone;
  if (hsDeal.description) partial.notes = hsDeal.description;
  if (closeDateStr) partial.closeDate = closeDateStr;

  return partial;
}

// ── LWW Conflict Resolution with Sophia Authority Bias ──────────────────────

/**
 * Resolves conflicts between the current Sophia deal state and incoming CRM updates.
 *
 * Rules:
 * 1. Authority Bias: If the deal is `closed_won` and has an active signed enterprise contract,
 *    Sophia AI Factory is authoritative. Any attempt by external CRM to revert or downgrade
 *    the stage is rejected and marked 'ignored'.
 * 2. External CRM Authority: Contact details (email, phone, SDR notes) from external CRM
 *    are authoritative and applied.
 * 3. Last-Write-Wins (LWW): For remaining fields, compare timestamps. If incoming > existing,
 *    apply; otherwise ignore to prevent sync loops.
 */
export function resolveCrmConflict(
  currentDeal: SophiaDealSnapshot,
  incomingUpdate: Partial<SophiaDealSnapshot>,
  options: ConflictResolutionOptions = {}
): ConflictResolutionResult {
  const appliedFields: string[] = [];
  const ignoredFields: string[] = [];

  const resolved: SophiaDealSnapshot = { ...currentDeal };

  // Rule 1: Closed Won with signed contract authority check
  const isProtectedClosedWon =
    currentDeal.dealStage === 'closed_won' && options.hasSignedContract === true;

  if (isProtectedClosedWon && incomingUpdate.dealStage && incomingUpdate.dealStage !== 'closed_won') {
    ignoredFields.push('dealStage');
  } else if (incomingUpdate.dealStage && incomingUpdate.dealStage !== currentDeal.dealStage) {
    resolved.dealStage = incomingUpdate.dealStage;
    appliedFields.push('dealStage');
  }

  // Rule 2: Contact info & SDR notes from CRM are authoritative
  if (incomingUpdate.leadEmail !== undefined && incomingUpdate.leadEmail !== currentDeal.leadEmail) {
    resolved.leadEmail = incomingUpdate.leadEmail;
    appliedFields.push('leadEmail');
  }
  if (incomingUpdate.leadPhone !== undefined && incomingUpdate.leadPhone !== currentDeal.leadPhone) {
    resolved.leadPhone = incomingUpdate.leadPhone;
    appliedFields.push('leadPhone');
  }
  if (incomingUpdate.sdrNotes !== undefined && incomingUpdate.sdrNotes !== currentDeal.sdrNotes) {
    resolved.sdrNotes = incomingUpdate.sdrNotes;
    appliedFields.push('sdrNotes');
  }
  if (incomingUpdate.notes !== undefined && incomingUpdate.notes !== currentDeal.notes) {
    resolved.notes = incomingUpdate.notes;
    appliedFields.push('notes');
  }

  // Rule 3: Timestamp comparison for commercial values (dealValueEstimateCents, currency, closeDate)
  const incomingTs = options.incomingTimestamp ?? Date.now();
  const existingTs = options.existingTimestamp ?? (currentDeal.updatedAt || 0);
  const isIncomingFresher = incomingTs > existingTs;

  if (incomingUpdate.dealValueEstimateCents !== undefined && incomingUpdate.dealValueEstimateCents !== currentDeal.dealValueEstimateCents) {
    if (isProtectedClosedWon) {
      // Commercial value of closed won contract cannot be downgraded by external CRM
      ignoredFields.push('dealValueEstimateCents');
    } else if (isIncomingFresher) {
      resolved.dealValueEstimateCents = incomingUpdate.dealValueEstimateCents;
      appliedFields.push('dealValueEstimateCents');
    } else {
      ignoredFields.push('dealValueEstimateCents');
    }
  }

  if (incomingUpdate.currency !== undefined && incomingUpdate.currency !== currentDeal.currency) {
    if (isIncomingFresher) {
      resolved.currency = incomingUpdate.currency;
      appliedFields.push('currency');
    } else {
      ignoredFields.push('currency');
    }
  }

  if (incomingUpdate.closeDate !== undefined && incomingUpdate.closeDate !== currentDeal.closeDate) {
    if (isIncomingFresher) {
      resolved.closeDate = incomingUpdate.closeDate;
      appliedFields.push('closeDate');
    } else {
      ignoredFields.push('closeDate');
    }
  }

  // Determine overall action and reason
  if (appliedFields.length === 0 && ignoredFields.length > 0) {
    return {
      action: 'ignore',
      reason: isProtectedClosedWon && ignoredFields.includes('dealStage')
        ? 'SOPHIA_CLOSED_WON_CONTRACT_AUTHORITY_BIAS: Reverting closed_won deal with signed contract is rejected'
        : 'STALE_UPDATE_IGNORED: Incoming update is older than or equal to existing record',
      resolvedDeal: resolved,
      appliedFields,
      ignoredFields,
    };
  }

  return {
    action: 'apply',
    reason: isProtectedClosedWon && ignoredFields.includes('dealStage')
      ? 'PARTIAL_APPLY_WITH_STAGE_PROTECTION: Updated CRM attributes while preserving closed_won authority'
      : 'APPLIED_LWW_UPDATE: Successfully resolved and applied CRM updates',
    resolvedDeal: resolved,
    appliedFields,
    ignoredFields,
  };
}

// ── Database Operations ─────────────────────────────────────────────────────

/**
 * Saves or updates an Enterprise CRM config for a tenant.
 */
export async function saveCrmConfig(
  db: D1Database,
  input: UpsertCrmConfigInput
): Promise<EnterpriseCrmConfig> {
  const now = Date.now();
  const id = input.id || generateId('crmcfg');
  const isActiveNum = input.isActive === false ? 0 : 1;
  const fieldMappingJson = JSON.stringify(input.fieldMapping || {});

  const query = `
    INSERT INTO enterprise_crm_configs (
      id, tenant_id, provider, api_endpoint, client_id,
      client_secret_encrypted, refresh_token_encrypted, access_token_encrypted,
      token_expires_at, sync_direction, is_active, field_mapping_json,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(tenant_id, provider) DO UPDATE SET
      api_endpoint = excluded.api_endpoint,
      client_id = excluded.client_id,
      client_secret_encrypted = excluded.client_secret_encrypted,
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      access_token_encrypted = excluded.access_token_encrypted,
      token_expires_at = excluded.token_expires_at,
      sync_direction = excluded.sync_direction,
      is_active = excluded.is_active,
      field_mapping_json = excluded.field_mapping_json,
      updated_at = excluded.updated_at
  `;

  await db
    .prepare(query)
    .bind(
      id,
      input.tenantId,
      input.provider,
      input.apiEndpoint || null,
      input.clientId || null,
      input.clientSecretEncrypted || null,
      input.refreshTokenEncrypted || null,
      input.accessTokenEncrypted || null,
      input.tokenExpiresAt || null,
      input.syncDirection || 'bidirectional',
      isActiveNum,
      fieldMappingJson,
      now,
      now
    )
    .run();

  const retrieved = await getCrmConfig(db, input.tenantId, input.provider);
  if (!retrieved) {
    throw new Error(`Failed to retrieve saved CRM config for ${input.provider}`);
  }
  return retrieved;
}

/**
 * Retrieves a CRM config by tenant and provider.
 */
export async function getCrmConfig(
  db: D1Database,
  tenantId: string,
  provider: CrmProvider
): Promise<EnterpriseCrmConfig | null> {
  const row = await db
    .prepare('SELECT * FROM enterprise_crm_configs WHERE tenant_id = ? AND provider = ?')
    .bind(tenantId, provider)
    .first<EnterpriseCrmConfigRow>();

  if (!row) return null;
  return mapCrmConfigRow(row);
}

/**
 * Lists all CRM configs for a tenant.
 */
export async function listCrmConfigs(
  db: D1Database,
  tenantId: string
): Promise<EnterpriseCrmConfig[]> {
  const result = await db
    .prepare('SELECT * FROM enterprise_crm_configs WHERE tenant_id = ? ORDER BY provider ASC')
    .bind(tenantId)
    .all<EnterpriseCrmConfigRow>();

  return (result.results || []).map(mapCrmConfigRow);
}

/**
 * Records a CRM sync event (inbound or outbound).
 */
export async function recordCrmSyncEvent(
  db: D1Database,
  input: RecordCrmSyncEventInput
): Promise<CrmSyncEvent> {
  const id = input.id || generateId('sync');
  const now = Date.now();
  const status = input.status || 'pending';
  const payloadJson = JSON.stringify(input.payload || {});

  const query = `
    INSERT INTO crm_sync_events (
      id, tenant_id, crm_config_id, entity_type, entity_id,
      external_id, direction, status, payload_json, error_message,
      retry_count, next_retry_at, synced_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `;

  await db
    .prepare(query)
    .bind(
      id,
      input.tenantId,
      input.crmConfigId,
      input.entityType,
      input.entityId,
      input.externalId || null,
      input.direction,
      status,
      payloadJson,
      input.errorMessage || null,
      input.retryCount || 0,
      input.nextRetryAt || null,
      input.syncedAt || (status === 'synced' ? now : null),
      now,
      now
    )
    .run();

  const row = await db
    .prepare('SELECT * FROM crm_sync_events WHERE id = ?')
    .bind(id)
    .first<CrmSyncEventRow>();

  if (!row) {
    throw new Error(`Failed to retrieve recorded CRM sync event ${id}`);
  }
  return mapCrmSyncEventRow(row);
}

/**
 * Updates a CRM sync event status and retry metrics.
 */
export async function updateCrmSyncEvent(
  db: D1Database,
  id: string,
  updates: {
    status?: CrmSyncStatus;
    externalId?: string | null;
    errorMessage?: string | null;
    retryCount?: number;
    nextRetryAt?: number | null;
    syncedAt?: number | null;
  }
): Promise<CrmSyncEvent | null> {
  const parts: string[] = [];
  const bindings: unknown[] = [];
  const now = Date.now();

  if (updates.status !== undefined) {
    parts.push('status = ?');
    bindings.push(updates.status);
  }
  if (updates.externalId !== undefined) {
    parts.push('external_id = ?');
    bindings.push(updates.externalId);
  }
  if (updates.errorMessage !== undefined) {
    parts.push('error_message = ?');
    bindings.push(updates.errorMessage);
  }
  if (updates.retryCount !== undefined) {
    parts.push('retry_count = ?');
    bindings.push(updates.retryCount);
  }
  if (updates.nextRetryAt !== undefined) {
    parts.push('next_retry_at = ?');
    bindings.push(updates.nextRetryAt);
  }
  if (updates.syncedAt !== undefined) {
    parts.push('synced_at = ?');
    bindings.push(updates.syncedAt);
  }

  parts.push('updated_at = ?');
  bindings.push(now);

  bindings.push(id);

  await db
    .prepare(`UPDATE crm_sync_events SET ${parts.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run();

  const row = await db
    .prepare('SELECT * FROM crm_sync_events WHERE id = ?')
    .bind(id)
    .first<CrmSyncEventRow>();

  if (!row) return null;
  return mapCrmSyncEventRow(row);
}

/**
 * Lists recent CRM sync events for a tenant.
 */
export async function listCrmSyncEvents(
  db: D1Database,
  tenantId: string,
  limit = 50
): Promise<CrmSyncEvent[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const result = await db
    .prepare('SELECT * FROM crm_sync_events WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?')
    .bind(tenantId, safeLimit)
    .all<CrmSyncEventRow>();

  return (result.results || []).map(mapCrmSyncEventRow);
}
