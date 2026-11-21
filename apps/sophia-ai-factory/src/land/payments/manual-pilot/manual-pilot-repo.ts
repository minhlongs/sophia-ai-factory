/**
 * Manual Pilot Settlement Repository (D1 Raw SQL).
 * Layer: land/payments/manual-pilot
 */

import type { D1Database } from '@cloudflare/workers-types';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import { success, failure, type Result } from '@/seed/types/result';
import type {
  ManualPilotAuditAction,
  ManualPilotError,
  ManualPilotSettlement,
  ManualPilotStatus,
} from './types';

export interface CreateSettlementParams {
  orderId: string;
  userId: string;
  orgId?: string;
  transferReference: string;
  expectedAmountVnd?: number;
  nowIso?: string;
}

export async function createManualPilotSettlementRow(
  rawDb: D1Database,
  params: CreateSettlementParams,
): Promise<Result<ManualPilotSettlement, ManualPilotError>> {
  const now = params.nowIso ?? new Date().toISOString();
  const id = `mps_${crypto.randomUUID()}`;
  const expected = params.expectedAmountVnd ?? OPTION_A_PILOT_CONTRACT.priceVnd;
  const auditId = `mpa_${crypto.randomUUID()}`;

  try {
    if (expected !== OPTION_A_PILOT_CONTRACT.priceVnd) {
      return failure({ code: 'AMOUNT_MISMATCH', message: 'Pilot price must match canonical contract' });
    }
    const memberships = await rawDb.prepare('SELECT org_id FROM org_members WHERE user_id = ?')
      .bind(params.userId).all<{ org_id: string }>();
    const orgId = params.orgId ?? (memberships.results.length === 1 ? memberships.results[0].org_id : null);
    if (!orgId || !memberships.results.some((row) => row.org_id === orgId)) {
      return failure({ code: 'VALIDATION_ERROR', message: 'An unambiguous authorized tenant is required' });
    }
    const [insertRes] = await rawDb.batch([
      rawDb
        .prepare(
          `INSERT INTO manual_pilot_settlements (
             id, order_id, user_id, sku_code, expected_amount_vnd,
             transfer_reference, status, created_at, updated_at, org_id
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending_manual_payment', ?7, ?7, ?8)
           ON CONFLICT(order_id) DO NOTHING`,
        )
        .bind(
          id,
          params.orderId,
          params.userId,
          OPTION_A_PILOT_CONTRACT.skuCode,
          expected,
          params.transferReference,
          now,
          orgId,
        ),
      rawDb
        .prepare(
          `INSERT INTO manual_pilot_audit_log (
             id, settlement_id, order_id, action, actor_admin_id, actor_role, metadata_json, created_at
           )
           SELECT ?1, id, order_id, 'created', NULL, 'system', ?2, ?3
           FROM manual_pilot_settlements
           WHERE order_id = ?4 AND changes() = 1`,
        )
        .bind(
          auditId,
          JSON.stringify({ expectedAmountVnd: expected, transferReference: params.transferReference }),
          now,
          params.orderId,
        ),
      rawDb.prepare(`INSERT INTO manual_pilot_financial_state(order_id,org_id,state,updated_at)
        SELECT order_id,org_id,'PENDING_ORDER',? FROM manual_pilot_settlements WHERE id=?`)
        .bind(now,id),
    ]);

    const existing = await getManualPilotSettlementByOrderId(rawDb, params.orderId, {userId:params.userId,orgId});
    if (existing && (existing.user_id !== params.userId || existing.org_id !== orgId)) {
      return failure({ code: 'VALIDATION_ERROR', message: 'Order belongs to a different tenant or user' });
    }
    if (!existing) {
      return failure({ code: 'DB_ERROR', message: 'Failed to create or load manual pilot settlement' });
    }
    if (existing.transfer_reference !== params.transferReference) {
      return failure({ code: 'VALIDATION_ERROR', message: 'Order already has a different transfer reference' });
    }
    if ((insertRes.meta?.changes ?? 0) === 0) {
      return success(existing);
    }
    return success(existing);
  } catch (err) {
    return failure({
      code: 'DB_ERROR',
      message: err instanceof Error ? err.message : 'Database error creating manual pilot settlement',
    });
  }
}

export type ManualPilotScope = { adminId: string } | { userId: string; orgId: string };
function scopeSql(scope: ManualPilotScope): { sql: string; values: string[] } {
  if ('adminId' in scope) return {
    sql: "EXISTS(SELECT 1 FROM user_profiles p WHERE p.user_id=? AND p.role='admin')", values:[scope.adminId],
  };
  return { sql: `s.user_id=? AND s.org_id=? AND EXISTS(SELECT 1 FROM org_members m
    WHERE m.user_id=s.user_id AND m.org_id=s.org_id)`, values:[scope.userId,scope.orgId] };
}
export async function getManualPilotSettlementByOrderId(
  rawDb: D1Database, orderId: string, scope: ManualPilotScope,
): Promise<ManualPilotSettlement | null> {
  const access=scopeSql(scope);
  return rawDb.prepare(`SELECT s.* FROM manual_pilot_settlements s WHERE s.order_id=? AND ${access.sql}`)
    .bind(orderId,...access.values).first<ManualPilotSettlement>();
}
export async function getManualPilotSettlementByBankRef(
  rawDb: D1Database, bankTransactionRef: string, scope: ManualPilotScope,
): Promise<ManualPilotSettlement | null> {
  const access=scopeSql(scope);
  return rawDb.prepare(`SELECT s.* FROM manual_pilot_settlements s WHERE s.bank_transaction_ref=? AND ${access.sql}`)
    .bind(bankTransactionRef,...access.values).first<ManualPilotSettlement>();
}
export async function listManualPilotSettlements(
  rawDb: D1Database, options: { status?: ManualPilotStatus; limit?: number; scope: ManualPilotScope },
): Promise<ManualPilotSettlement[]> {
  const limit=Math.min(Math.max(options.limit ?? 50,1),200);
  const access=scopeSql(options.scope);
  const res=await rawDb.prepare(`SELECT s.* FROM manual_pilot_settlements s WHERE ${access.sql}
    ${options.status ? 'AND s.status=?' : ''} ORDER BY s.created_at DESC LIMIT ?`)
    .bind(...access.values,...(options.status ? [options.status] : []),limit).all<ManualPilotSettlement>();
  return res.results ?? [];
}

export async function appendManualPilotAudit(
  rawDb: D1Database,
  params: {
    settlementId: string;
    orderId: string;
    action: ManualPilotAuditAction;
    actorAdminId: string | null;
    actorRole: string;
    metadata?: Record<string, unknown>;
    nowIso?: string;
  },
): Promise<void> {
  const now = params.nowIso ?? new Date().toISOString();
  await rawDb
    .prepare(
      `INSERT INTO manual_pilot_audit_log (
         id, settlement_id, order_id, action, actor_admin_id, actor_role, metadata_json, created_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      `mpa_${crypto.randomUUID()}`,
      params.settlementId,
      params.orderId,
      params.action,
      params.actorAdminId,
      params.actorRole,
      params.metadata ? JSON.stringify(params.metadata) : null,
      now,
    )
    .run();
}
