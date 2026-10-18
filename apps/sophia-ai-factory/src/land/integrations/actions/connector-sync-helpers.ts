/**
 * Outbound CRM Payload Builder Helpers
 *
 * Layer: land/integrations/actions
 *
 * @module land/integrations/actions/connector-sync-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  CrmProvider,
  CrmEntityType,
  SophiaDealSnapshot,
} from './types';
import {
  transformSophiaToSalesforce,
  transformSophiaToHubSpot,
} from '@/tree/integrations/crm-sync-engine';
import { getEnterpriseDealById } from '@/tree/sales/enterprise-deal-repo';

export async function buildCrmEntityPayload(
  db: D1Database,
  provider: CrmProvider,
  entityType: CrmEntityType,
  entityId: string,
): Promise<Record<string, unknown>> {
  if (entityType !== 'deal') {
    return {};
  }

  const deal = await getEnterpriseDealById(db, entityId);
  if (!deal) {
    throw new Error(`Enterprise deal not found with ID '${entityId}'`);
  }

  const snapshot: SophiaDealSnapshot = {
    id: deal.id,
    leadName: deal.leadName,
    leadEmail: deal.leadEmail,
    leadPhone: deal.leadPhone,
    companyName: deal.companyName,
    companyDomain: deal.companyDomain,
    dealStage: deal.dealStage,
    dealValueEstimateCents: deal.dealValueEstimateCents,
    currency: deal.currency,
    notes: deal.notes,
    updatedAt: deal.updatedAt,
  };

  if (provider === 'salesforce') {
    return transformSophiaToSalesforce(snapshot) as unknown as Record<string, unknown>;
  }
  if (provider === 'hubspot') {
    return transformSophiaToHubSpot(snapshot) as unknown as Record<string, unknown>;
  }
  return snapshot as unknown as Record<string, unknown>;
}
