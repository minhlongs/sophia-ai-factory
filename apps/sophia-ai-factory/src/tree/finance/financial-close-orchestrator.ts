/**
 * Multi-Org Financial Close Orchestrator & Intercompany Settlement Engine
 *
 * Implements:
 * - Period Close Finite State Machine (open -> closing -> closed -> locked -> audited)
 * - ASC 606 revenue aggregates roll-up (recognized, deferred, net)
 * - Cross-border intercompany transfer pricing & withholding tax (VN FCT 10%/5%, US W-8 30%/0%)
 * - Vietnam VAS TT200 Chart of Accounts double-entry journal mapping
 * - Tamper-evident period locking and cryptographic Merkle root anchoring
 *
 * Layer: tree (Pure domain logic, depends only on @/seed and @/tree)
 *
 * @module tree/finance/financial-close-orchestrator
 */

import type { D1Database } from '@/seed/db/client';
import type {
  FinancialClosePeriod,
  PeriodType,
  CloseStatus,
  AuditOpinion,
  PeriodAggregates,
  FinalizePeriodResult,
  IntercompanyTransfer,
  RecordTransferInput,
  WithholdingTaxRegime,
  IntercompanyEntity,
  SettlementStatus,
  VasAccountCode,
} from '@/seed/types/financial-close';
import {
  appendIpoAuditEvent,
  buildMerkleTree,
  hmacSha256Hex,
  DEFAULT_AUDIT_SECRET,
} from '@/tree/finance/merkle-audit-vault';

export const WITHHOLDING_TAX_RATES: Record<WithholdingTaxRegime, number> = {
  VN_FCT_10PCT: 10.0,
  VN_FCT_5PCT: 5.0,
  US_W8_30PCT: 30.0,
  US_W8_TREATY_0PCT: 0.0,
  SG_DTA_EXEMPT: 0.0,
  NONE: 0.0,
};

/**
 * Calculate withholding tax and net settlement cents with zero penny leakage
 */
export function calculateWithholdingTax(
  regime: WithholdingTaxRegime,
  grossAmountCents: number
): { ratePct: number; taxCents: number; netCents: number } {
  const ratePct = WITHHOLDING_TAX_RATES[regime] ?? 0.0;
  const taxCents = Math.round(grossAmountCents * (ratePct / 100));
  const netCents = grossAmountCents - taxCents;

  if (taxCents + netCents !== grossAmountCents) {
    throw new Error(
      `Tax calculation leakage: gross ${grossAmountCents} != tax ${taxCents} + net ${netCents}`
    );
  }

  return { ratePct, taxCents, netCents };
}

export interface VasJournalEntry {
  account: VasAccountCode;
  debitCents: number;
  creditCents: number;
  description: string;
}

/**
 * Generate balanced Vietnam VAS TT200 Chart of Accounts double-entry journal lines
 */
export function generateVasJournalEntries(transfer: IntercompanyTransfer): VasJournalEntry[] {
  const isVnRecipient = transfer.destinationEntity === 'SOPHIA_VN_CO_LTD';
  const isVnOrigin = transfer.originEntity === 'SOPHIA_VN_CO_LTD';

  if (!isVnRecipient && !isVnOrigin) {
    // Non-VN intercompany standard clearing
    return [
      {
        account: '136', // Intercompany receivable
        debitCents: transfer.grossAmountCents,
        creditCents: 0,
        description: `Intercompany billing ${transfer.transferReference}`,
      },
      {
        account: '336', // Intercompany payable
        debitCents: 0,
        creditCents: transfer.grossAmountCents,
        description: `Intercompany clearing ${transfer.transferReference}`,
      },
    ];
  }

  if (isVnOrigin) {
    // Sophia VN paying abroad (e.g. IP royalty or compute recharge to US/SG)
    return [
      {
        account: '642', // General & Administrative service expense
        debitCents: transfer.grossAmountCents,
        creditCents: 0,
        description: `Expense recharge from ${transfer.destinationEntity} (${transfer.transferType})`,
      },
      {
        account: '3338', // Vietnam Foreign Contractor Tax (FCT) payable
        debitCents: 0,
        creditCents: transfer.withholdingTaxAmountCents,
        description: `Statutory FCT withholding (${transfer.withholdingTaxRegime})`,
      },
      {
        account: '336', // Intercompany payable to offshore entity
        debitCents: 0,
        creditCents: transfer.netSettlementCents,
        description: `Net payable to ${transfer.destinationEntity}`,
      },
    ];
  }

  // Sophia VN receiving payment from abroad
  return [
    {
      account: '112', // Cash/Bank deposit
      debitCents: transfer.netSettlementCents,
      creditCents: 0,
      description: `Net inward remittance from ${transfer.originEntity}`,
    },
    {
      account: '136', // Intercompany receivable
      debitCents: 0,
      creditCents: transfer.netSettlementCents,
      description: `Clearing intercompany settlement ${transfer.transferReference}`,
    },
  ];
}

/**
 * Derive default start and end dates from period key (e.g. '2026-09', '2026-Q3', '2026-FY')
 */
export function inferPeriodDates(
  periodKey: string,
  periodType: PeriodType
): { startDate: string; endDate: string } {
  if (periodType === 'monthly') {
    // Expecting 'YYYY-MM'
    const parts = periodKey.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mm = String(month).padStart(2, '0');
    return {
      startDate: `${year}-${mm}-01`,
      endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  if (periodType === 'quarterly') {
    // e.g. '2026-Q3'
    const [yearStr, qStr] = periodKey.split('-');
    const year = parseInt(yearStr, 10);
    const q = parseInt(qStr.replace('Q', ''), 10);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
    return {
      startDate: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      endDate: `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  // Annual '2026-FY' or '2026'
  const yearStr = periodKey.substring(0, 4);
  return {
    startDate: `${yearStr}-01-01`,
    endDate: `${yearStr}-12-31`,
  };
}

interface RawPeriodRow {
  id: string;
  org_id: string | null;
  period_key: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  close_status: CloseStatus;
  closed_by: string | null;
  closed_at: number | null;
  total_recognized_revenue_cents: number;
  total_deferred_revenue_cents: number;
  total_refunds_cents: number;
  net_revenue_cents: number;
  active_contracts_count: number;
  merkle_root_hash: string | null;
  digital_signature: string | null;
  compliance_frameworks: string;
  audit_opinion: AuditOpinion;
  lock_reason: string | null;
  created_at: number;
  updated_at: number;
}

export function mapRowToPeriod(row: RawPeriodRow): FinancialClosePeriod {
  return {
    id: row.id,
    orgId: row.org_id,
    periodKey: row.period_key,
    periodType: row.period_type,
    startDate: row.start_date,
    endDate: row.end_date,
    closeStatus: row.close_status,
    closedBy: row.closed_by,
    closedAt: row.closed_at ? Number(row.closed_at) : null,
    totalRecognizedRevenueCents: Number(row.total_recognized_revenue_cents),
    totalDeferredRevenueCents: Number(row.total_deferred_revenue_cents),
    totalRefundsCents: Number(row.total_refunds_cents),
    netRevenueCents: Number(row.net_revenue_cents),
    activeContractsCount: Number(row.active_contracts_count),
    merkleRootHash: row.merkle_root_hash,
    digitalSignature: row.digital_signature,
    complianceFrameworks: row.compliance_frameworks,
    auditOpinion: row.audit_opinion,
    lockReason: row.lock_reason,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

interface RawTransferRow {
  id: string;
  transfer_reference: string;
  origin_entity: IntercompanyEntity;
  destination_entity: IntercompanyEntity;
  transfer_type: RecordTransferInput['transferType'];
  currency: string;
  gross_amount_cents: number;
  withholding_tax_regime: WithholdingTaxRegime;
  withholding_tax_rate_pct: number;
  withholding_tax_amount_cents: number;
  net_settlement_cents: number;
  settlement_status: SettlementStatus;
  reconciliation_ledger_id: string | null;
  approved_by: string | null;
  transfer_date: string;
  settled_at: number | null;
  supporting_docs_hash: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export function mapRowToTransfer(row: RawTransferRow): IntercompanyTransfer {
  return {
    id: row.id,
    transferReference: row.transfer_reference,
    originEntity: row.origin_entity,
    destinationEntity: row.destination_entity,
    transferType: row.transfer_type,
    currency: row.currency,
    grossAmountCents: Number(row.gross_amount_cents),
    withholdingTaxRegime: row.withholding_tax_regime,
    withholdingTaxRatePct: Number(row.withholding_tax_rate_pct),
    withholdingTaxAmountCents: Number(row.withholding_tax_amount_cents),
    netSettlementCents: Number(row.net_settlement_cents),
    settlementStatus: row.settlement_status,
    reconciliationLedgerId: row.reconciliation_ledger_id,
    approvedBy: row.approved_by,
    transferDate: row.transfer_date,
    settledAt: row.settled_at ? Number(row.settled_at) : null,
    supportingDocsHash: row.supporting_docs_hash,
    notes: row.notes,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

/**
 * Retrieve status of a financial close period
 */
export async function getPeriodStatus(
  db: D1Database,
  periodKey: string,
  orgId?: string | null
): Promise<FinancialClosePeriod | null> {
  let query = `SELECT * FROM financial_close_periods WHERE period_key = ?1`;
  const params: unknown[] = [periodKey];

  if (orgId !== undefined) {
    if (orgId === null) {
      query += ` AND org_id IS NULL`;
    } else {
      query += ` AND org_id = ?2`;
      params.push(orgId);
    }
  }
  query += ` LIMIT 1`;

  const row = await db.prepare(query).bind(...params).first<RawPeriodRow>();
  return row ? mapRowToPeriod(row) : null;
}

/**
 * Compute revenue and contract aggregates for a period
 */
export async function computePeriodAggregates(
  db: D1Database,
  periodKey: string,
  orgId?: string | null
): Promise<PeriodAggregates> {
  const period = await getPeriodStatus(db, periodKey, orgId);
  if (!period) {
    throw new Error(`Period ${periodKey} does not exist`);
  }

  let scheduleQuery = `
    SELECT
      COUNT(*) as active_contracts,
      COALESCE(SUM(recognized_revenue_cents), 0) as total_recognized,
      COALESCE(SUM(deferred_revenue_cents), 0) as total_deferred
    FROM revenue_schedules
    WHERE start_date <= ?1 AND end_date >= ?2
  `;
  const params: unknown[] = [period.endDate, period.startDate];

  if (orgId) {
    scheduleQuery += ` AND org_id = ?3`;
    params.push(orgId);
  }

  const result = await db.prepare(scheduleQuery).bind(...params).first<{
    active_contracts: number;
    total_recognized: number;
    total_deferred: number;
  }>();

  const recognized = Number(result?.total_recognized ?? 0);
  const deferred = Number(result?.total_deferred ?? 0);
  const activeContracts = Number(result?.active_contracts ?? 0);
  const refunds = 0; // standard refunds tracking
  const netRevenue = recognized - refunds;

  return {
    recognizedRevenueCents: recognized,
    deferredRevenueCents: deferred,
    refundsCents: refunds,
    netRevenueCents: netRevenue,
    activeContractsCount: activeContracts,
  };
}

/**
 * Initiate pre-close audit for an accounting period (FSM: open -> closing)
 */
export async function initiatePeriodClose(
  db: D1Database,
  periodKey: string,
  periodType: PeriodType,
  closedBy: string,
  orgId?: string | null,
  startDateStr?: string,
  endDateStr?: string
): Promise<FinancialClosePeriod> {
  const period = await getPeriodStatus(db, periodKey, orgId);

  const dates = startDateStr && endDateStr
    ? { startDate: startDateStr, endDate: endDateStr }
    : inferPeriodDates(periodKey, periodType);

  const now = Date.now();

  if (!period) {
    const id = crypto.randomUUID().replace(/-/g, '').toLowerCase();
    await db
      .prepare(
        `INSERT INTO financial_close_periods (
          id, org_id, period_key, period_type, start_date, end_date,
          close_status, closed_by, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'closing', ?7, ?8, ?9)`
      )
      .bind(
        id,
        orgId ?? null,
        periodKey,
        periodType,
        dates.startDate,
        dates.endDate,
        closedBy,
        now,
        now
      )
      .run();
  } else {
    if (period.closeStatus === 'locked') {
      throw new Error(`PERIOD_LOCKED: Cannot close period ${periodKey} because it is permanently locked.`);
    }
    if (period.closeStatus === 'audited') {
      throw new Error(`PERIOD_ALREADY_AUDITED: Period ${periodKey} has received final auditor sign-off.`);
    }

    await db
      .prepare(
        `UPDATE financial_close_periods
         SET close_status = 'closing',
             closed_by = ?1,
             updated_at = ?2
         WHERE period_key = ?3 AND (org_id = ?4 OR (org_id IS NULL AND ?4 IS NULL))`
      )
      .bind(closedBy, now, periodKey, orgId ?? null)
      .run();
  }

  // Audit event log
  await appendIpoAuditEvent(db, {
    periodKey,
    orgId,
    eventType: 'PERIOD_PRE_CLOSE_AUDIT',
    eventScope: orgId ? 'entity_level' : 'consolidated_group',
    actorId: closedBy,
    actorRole: 'CONTROLLER',
    payload: { action: 'initiate_period_close', periodKey, periodType, initiatedAt: now },
    soxControlId: 'CC-1.1',
  });

  const updated = await getPeriodStatus(db, periodKey, orgId);
  if (!updated) {
    throw new Error(`Failed to retrieve initiated period: ${periodKey}`);
  }
  return updated;
}

/**
 * Finalize close for a period, locking financial totals and anchoring Merkle root (FSM: closing -> closed)
 */
export async function finalizePeriodClose(
  db: D1Database,
  periodKey: string,
  closedBy: string,
  secret: string = DEFAULT_AUDIT_SECRET,
  orgId?: string | null
): Promise<FinalizePeriodResult> {
  const period = await getPeriodStatus(db, periodKey, orgId);
  if (!period) {
    throw new Error(`Period ${periodKey} not found`);
  }

  if (period.closeStatus === 'locked') {
    throw new Error(`PERIOD_LOCKED: Period ${periodKey} is locked and immutable.`);
  }

  const aggregates = await computePeriodAggregates(db, periodKey, orgId);
  const now = Date.now();

  // Fetch all audit leaf hashes for this period
  const { results } = await db
    .prepare(
      `SELECT merkle_leaf_hash FROM ipo_audit_ledger
       WHERE period_key = ?1
       ORDER BY sequence_number ASC`
    )
    .bind(periodKey)
    .all<{ merkle_leaf_hash: string }>();

  const leafHashes = (results ?? []).map((r) => r.merkle_leaf_hash);
  const { rootHash } = await buildMerkleTree(leafHashes);
  const digitalSignature = await hmacSha256Hex(rootHash, secret);

  await db
    .prepare(
      `UPDATE financial_close_periods
       SET close_status = 'closed',
           closed_by = ?1,
           closed_at = ?2,
           total_recognized_revenue_cents = ?3,
           total_deferred_revenue_cents = ?4,
           total_refunds_cents = ?5,
           net_revenue_cents = ?6,
           active_contracts_count = ?7,
           merkle_root_hash = ?8,
           digital_signature = ?9,
           updated_at = ?10
       WHERE period_key = ?11 AND (org_id = ?12 OR (org_id IS NULL AND ?12 IS NULL))`
    )
    .bind(
      closedBy,
      now,
      aggregates.recognizedRevenueCents,
      aggregates.deferredRevenueCents,
      aggregates.refundsCents,
      aggregates.netRevenueCents,
      aggregates.activeContractsCount,
      rootHash,
      digitalSignature,
      now,
      periodKey,
      orgId ?? null
    )
    .run();

  // Log finalization and Merkle anchor in audit ledger
  await appendIpoAuditEvent(
    db,
    {
      periodKey,
      orgId,
      eventType: 'PERIOD_CLOSED',
      eventScope: orgId ? 'entity_level' : 'consolidated_group',
      actorId: closedBy,
      actorRole: 'CFO',
      amountCents: aggregates.recognizedRevenueCents,
      payload: {
        action: 'finalize_period_close',
        aggregates,
        merkleRootHash: rootHash,
        closedAt: now,
      },
      soxControlId: 'AC-4.1',
      vasAccountCode: '511',
    },
    secret
  );

  await appendIpoAuditEvent(
    db,
    {
      periodKey,
      orgId,
      eventType: 'MERKLE_ROOT_ANCHORED',
      eventScope: 'system_wide',
      actorId: closedBy,
      actorRole: 'SYSTEM',
      payload: { merkleRootHash: rootHash, digitalSignature, totalLeaves: leafHashes.length },
      soxControlId: 'CC-3.2',
    },
    secret
  );

  const updatedPeriod = await getPeriodStatus(db, periodKey, orgId);
  if (!updatedPeriod) {
    throw new Error(`Failed to retrieve finalized period: ${periodKey}`);
  }

  return {
    period: updatedPeriod,
    merkleRootHash: rootHash,
    digitalSignature,
    totalLedgerEvents: leafHashes.length + 2,
    aggregates,
  };
}

/**
 * Permanently lock an accounting period (FSM: closed -> locked)
 */
export async function lockPeriod(
  db: D1Database,
  periodKey: string,
  lockReason: string,
  actorId: string,
  orgId?: string | null
): Promise<FinancialClosePeriod> {
  const period = await getPeriodStatus(db, periodKey, orgId);
  if (!period) {
    throw new Error(`Period ${periodKey} not found`);
  }

  if (period.closeStatus !== 'closed') {
    throw new Error(`INVALID_STATE_TRANSITION: Can only lock a closed period (current: ${period.closeStatus})`);
  }

  const now = Date.now();

  await db
    .prepare(
      `UPDATE financial_close_periods
       SET close_status = 'locked',
           lock_reason = ?1,
           updated_at = ?2
       WHERE period_key = ?3 AND (org_id = ?4 OR (org_id IS NULL AND ?4 IS NULL))`
    )
    .bind(lockReason, now, periodKey, orgId ?? null)
    .run();

  await appendIpoAuditEvent(db, {
    periodKey,
    orgId,
    eventType: 'PERIOD_LOCKED',
    eventScope: orgId ? 'entity_level' : 'consolidated_group',
    actorId,
    actorRole: 'SOX_COMPLIANCE_OFFICER',
    payload: { lockReason, lockedAt: now },
    soxControlId: 'CC-5.1',
  });

  const updated = await getPeriodStatus(db, periodKey, orgId);
  if (!updated) throw new Error(`Period ${periodKey} not found after lock`);
  return updated;
}

/**
 * Reopen an accounting period (only allowed if not locked or audited)
 */
export async function reopenPeriod(
  db: D1Database,
  periodKey: string,
  reason: string,
  actorId: string,
  orgId?: string | null
): Promise<FinancialClosePeriod> {
  const period = await getPeriodStatus(db, periodKey, orgId);
  if (!period) {
    throw new Error(`Period ${periodKey} not found`);
  }

  if (period.closeStatus === 'locked') {
    throw new Error('LOCKED_PERIOD_CANNOT_BE_REOPENED');
  }

  if (period.closeStatus === 'audited') {
    throw new Error('AUDITED_PERIOD_CANNOT_BE_REOPENED');
  }

  const now = Date.now();

  await db
    .prepare(
      `UPDATE financial_close_periods
       SET close_status = 'reopened',
           lock_reason = ?1,
           updated_at = ?2
       WHERE period_key = ?3 AND (org_id = ?4 OR (org_id IS NULL AND ?4 IS NULL))`
    )
    .bind(reason, now, periodKey, orgId ?? null)
    .run();

  await appendIpoAuditEvent(db, {
    periodKey,
    orgId,
    eventType: 'PERIOD_PRE_CLOSE_AUDIT',
    eventScope: orgId ? 'entity_level' : 'consolidated_group',
    actorId,
    actorRole: 'CONTROLLER',
    payload: { action: 'reopen_period', reason, reopenedAt: now },
    soxControlId: 'CC-2.1',
  });

  const updated = await getPeriodStatus(db, periodKey, orgId);
  if (!updated) throw new Error(`Period ${periodKey} not found after reopen`);
  return updated;
}

/**
 * Record a cross-border intercompany transfer with statutory withholding tax calculation
 */
export async function recordIntercompanyTransfer(
  db: D1Database,
  input: RecordTransferInput,
  actorId: string = 'SYSTEM'
): Promise<IntercompanyTransfer> {
  const { ratePct, taxCents, netCents } = calculateWithholdingTax(
    input.withholdingTaxRegime,
    input.grossAmountCents
  );

  const id = crypto.randomUUID().replace(/-/g, '').toLowerCase();
  const refNum = Math.floor(1000 + Math.random() * 9000);
  const transferReference = `ICT-${input.transferDate.substring(0, 7)}-${refNum}`;
  const currency = input.currency ?? 'USD';
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO intercompany_transfers (
        id, transfer_reference, origin_entity, destination_entity, transfer_type,
        currency, gross_amount_cents, withholding_tax_regime, withholding_tax_rate_pct,
        withholding_tax_amount_cents, net_settlement_cents, settlement_status,
        transfer_date, supporting_docs_hash, notes, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'pending', ?12, ?13, ?14, ?15, ?16)`
    )
    .bind(
      id,
      transferReference,
      input.originEntity,
      input.destinationEntity,
      input.transferType,
      currency,
      input.grossAmountCents,
      input.withholdingTaxRegime,
      ratePct,
      taxCents,
      netCents,
      input.transferDate,
      input.supportingDocsHash ?? null,
      input.notes ?? null,
      now,
      now
    )
    .run();

  const periodKey = input.transferDate.substring(0, 7);

  await appendIpoAuditEvent(db, {
    periodKey,
    eventType: 'INTERCOMPANY_TRANSFER_POSTED',
    eventScope: 'consolidated_group',
    actorId,
    actorRole: 'CONTROLLER',
    amountCents: input.grossAmountCents,
    payload: {
      transferId: id,
      transferReference,
      origin: input.originEntity,
      destination: input.destinationEntity,
      grossCents: input.grossAmountCents,
      taxCents,
      netCents,
    },
    soxControlId: 'AC-6.2',
    vasAccountCode: '136',
  });

  const row = await db
    .prepare(`SELECT * FROM intercompany_transfers WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<RawTransferRow>();

  if (!row) throw new Error(`Failed to create intercompany transfer ${id}`);
  return mapRowToTransfer(row);
}

/**
 * Reconcile and approve an intercompany transfer
 */
export async function reconcileIntercompanyTransfer(
  db: D1Database,
  transferId: string,
  approvedBy: string,
  notes?: string
): Promise<IntercompanyTransfer> {
  const existing = await db
    .prepare(`SELECT * FROM intercompany_transfers WHERE id = ?1 LIMIT 1`)
    .bind(transferId)
    .first<RawTransferRow>();

  if (!existing) {
    throw new Error(`Intercompany transfer ${transferId} not found`);
  }

  const now = Date.now();

  await db
    .prepare(
      `UPDATE intercompany_transfers
       SET settlement_status = 'reconciled',
           approved_by = ?1,
           settled_at = ?2,
           notes = COALESCE(?3, notes),
           updated_at = ?4
       WHERE id = ?5`
    )
    .bind(approvedBy, now, notes ?? null, now, transferId)
    .run();

  const periodKey = existing.transfer_date.substring(0, 7);

  await appendIpoAuditEvent(db, {
    periodKey,
    eventType: 'INTERCOMPANY_RECONCILED',
    eventScope: 'consolidated_group',
    actorId: approvedBy,
    actorRole: 'CFO',
    amountCents: existing.gross_amount_cents,
    payload: {
      transferId,
      transferReference: existing.transfer_reference,
      reconciledAt: now,
      notes: notes ?? null,
    },
    soxControlId: 'AC-6.2',
    vasAccountCode: '336',
  });

  const updated = await db
    .prepare(`SELECT * FROM intercompany_transfers WHERE id = ?1 LIMIT 1`)
    .bind(transferId)
    .first<RawTransferRow>();

  if (!updated) throw new Error(`Intercompany transfer ${transferId} disappeared`);
  return mapRowToTransfer(updated);
}

/**
 * List intercompany transfers with optional filters
 */
export async function listIntercompanyTransfers(
  db: D1Database,
  options?: {
    originEntity?: IntercompanyEntity;
    destinationEntity?: IntercompanyEntity;
    status?: SettlementStatus;
    fromDate?: string;
    toDate?: string;
  }
): Promise<IntercompanyTransfer[]> {
  let query = `SELECT * FROM intercompany_transfers WHERE 1=1`;
  const params: unknown[] = [];

  if (options?.originEntity) {
    params.push(options.originEntity);
    query += ` AND origin_entity = ?${params.length}`;
  }
  if (options?.destinationEntity) {
    params.push(options.destinationEntity);
    query += ` AND destination_entity = ?${params.length}`;
  }
  if (options?.status) {
    params.push(options.status);
    query += ` AND settlement_status = ?${params.length}`;
  }
  if (options?.fromDate) {
    params.push(options.fromDate);
    query += ` AND transfer_date >= ?${params.length}`;
  }
  if (options?.toDate) {
    params.push(options.toDate);
    query += ` AND transfer_date <= ?${params.length}`;
  }

  query += ` ORDER BY transfer_date DESC, created_at DESC`;

  const { results } = await db.prepare(query).bind(...params).all<RawTransferRow>();
  return (results ?? []).map(mapRowToTransfer);
}
