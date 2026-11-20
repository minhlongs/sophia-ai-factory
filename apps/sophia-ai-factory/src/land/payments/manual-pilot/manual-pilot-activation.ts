/** Verified activation and terminal rejection use mutually exclusive batch claims.
 * Rejection commits both state projections and immutable audit, or nothing. */

import type { D1Database } from '@cloudflare/workers-types';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import { success, failure, type Result } from '@/seed/types/result';
import {
  getManualPilotSettlementByOrderId,
} from './manual-pilot-repo';
import type { ManualPilotError, ManualPilotSettlement } from './types';
import { requirePilotEffect, requirePilotClaimReleased } from './manual-pilot-required-effects';

export interface ApproveManualPilotParams {
  orderId: string;
  adminId: string;
  receivedAmountVnd: number;
  bankTransactionRef: string;
  payerNote?: string;
  auditNotes?: string;
  nowMs?: number;
}

export interface RejectManualPilotParams {
  orderId: string;
  adminId: string;
  auditNotes?: string;
  nowMs?: number;
}

export async function approveAndActivateManualPilot(
  rawDb: D1Database,
  params: ApproveManualPilotParams,
): Promise<Result<ManualPilotSettlement, ManualPilotError>> {
  const now = new Date(params.nowMs ?? Date.now()).toISOString();
  const ends = new Date(Date.parse(now) + OPTION_A_PILOT_CONTRACT.durationDays * 86400000).toISOString();
  const token = crypto.randomUUID();
  try {
    // Legacy typed references cannot establish settlement. Only durable evidence
    // and an independently approved state permit these mandatory effects.
    const guard = "order_id=? AND attempt_token=?";
    const [claim] = await rawDb.batch([
      rawDb.prepare(`UPDATE manual_pilot_financial_state SET attempt_token=?,updated_at=?
        WHERE order_id=? AND state='ADMIN_APPROVED' AND attempt_token IS NULL
        AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')
        AND EXISTS(SELECT 1 FROM manual_pilot_bank_evidence e JOIN manual_pilot_settlements s USING(order_id)
          WHERE e.id=manual_pilot_financial_state.evidence_id AND e.direction='inbound'
          AND e.order_id=manual_pilot_financial_state.order_id
          AND e.org_id=manual_pilot_financial_state.org_id AND s.org_id=manual_pilot_financial_state.org_id
          AND s.status IN ('pending_manual_payment','under_review')
          AND e.amount_vnd=s.expected_amount_vnd AND e.currency='VND' AND e.order_reference=s.transfer_reference)`)
        .bind(token,now,params.orderId,params.adminId),
      rawDb.prepare(`INSERT INTO manual_pilot_credit_grants(order_id,user_id,org_id,granted,expires_at)
        SELECT s.order_id,s.user_id,f.org_id,?,? FROM manual_pilot_financial_state f
        JOIN manual_pilot_settlements s USING(order_id) WHERE f.order_id=? AND f.attempt_token=?`)
        .bind(OPTION_A_PILOT_CONTRACT.includedMcu,ends,params.orderId,token),
      requirePilotEffect(rawDb,params.orderId,token),
      rawDb.prepare(`INSERT INTO manual_pilot_entitlements(order_id,user_id,org_id,starts_at,ends_at)
        SELECT s.order_id,s.user_id,f.org_id,?,? FROM manual_pilot_financial_state f
        JOIN manual_pilot_settlements s USING(order_id) WHERE f.order_id=? AND f.attempt_token=?`)
        .bind(now,ends,params.orderId,token),
      requirePilotEffect(rawDb,params.orderId,token),
      rawDb.prepare(`UPDATE manual_pilot_settlements SET status='activated',activated_at=?,
        entitlement_period_end=?,granted_mcu=?,received_amount_vnd=(SELECT amount_vnd FROM manual_pilot_bank_evidence
          WHERE id=(SELECT evidence_id FROM manual_pilot_financial_state WHERE order_id=?)),
        bank_transaction_ref=(SELECT transaction_identity FROM manual_pilot_bank_evidence
          WHERE id=(SELECT evidence_id FROM manual_pilot_financial_state WHERE order_id=?)),updated_at=?
        WHERE order_id=? AND EXISTS(SELECT 1 FROM manual_pilot_financial_state WHERE ${guard})`)
        .bind(now,ends,OPTION_A_PILOT_CONTRACT.includedMcu,params.orderId,params.orderId,now,params.orderId,params.orderId,token),
      requirePilotEffect(rawDb,params.orderId,token),
      rawDb.prepare(`UPDATE pending_orders SET status='completed' WHERE order_id=? AND status='pending'
        AND EXISTS(SELECT 1 FROM manual_pilot_financial_state WHERE ${guard})`)
        .bind(params.orderId,params.orderId,token),
      requirePilotEffect(rawDb,params.orderId,token),
      rawDb.prepare(`INSERT INTO manual_pilot_financial_events(id,order_id,from_state,to_state,actor_id,evidence_id,created_at)
        SELECT ?,order_id,'ADMIN_APPROVED','ACTIVE_14D',?,evidence_id,? FROM manual_pilot_financial_state WHERE ${guard}`)
        .bind(crypto.randomUUID(),params.adminId,now,params.orderId,token),
      requirePilotEffect(rawDb,params.orderId,token),
      rawDb.prepare(`INSERT INTO manual_pilot_audit_log
        (id,settlement_id,order_id,action,actor_admin_id,actor_role,created_at)
        SELECT ?,s.id,s.order_id,'approved_and_activated',?,'admin',? FROM manual_pilot_settlements s
        JOIN manual_pilot_financial_state f USING(order_id) WHERE f.order_id=? AND f.attempt_token=?`)
        .bind(crypto.randomUUID(),params.adminId,now,params.orderId,token),
      requirePilotEffect(rawDb,params.orderId,token),
      rawDb.prepare(`UPDATE manual_pilot_financial_state SET state='ACTIVE_14D',attempt_token=NULL WHERE ${guard}`)
        .bind(params.orderId,token),
      requirePilotClaimReleased(rawDb,params.orderId,token),
    ]);
    if (claim.meta.changes !== 1) return failure({code:'INVALID_STATE',message:'Independent settlement evidence and current admin approval required'});
    const row=await getManualPilotSettlementByOrderId(rawDb,params.orderId,{adminId:params.adminId});
    return row ? success(row) : failure({code:'DB_ERROR',message:'Activated settlement unavailable'});
  } catch {
    return failure({code:'DB_ERROR',message:'Activation transaction rolled back'});
  }
}

export async function rejectManualPilotSettlement(
  rawDb: D1Database,
  params: RejectManualPilotParams,
): Promise<Result<ManualPilotSettlement, ManualPilotError>> {
  try {
    const now = new Date(params.nowMs ?? Date.now()).toISOString();
    const settlement = await getManualPilotSettlementByOrderId(rawDb, params.orderId, { adminId: params.adminId });
    if (!settlement) return failure({ code: 'NOT_FOUND', message: 'Manual pilot order not found or unauthorized' });
    const token = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const auditId = crypto.randomUUID();
    const guard = 'order_id=? AND attempt_token=?';
    // Keep the previous state until its event is recorded. Only this fresh claim
    // can write effects; the final constrained update rejects missing audit rows.
    const [claim] = await rawDb.batch([
      rawDb.prepare(`UPDATE manual_pilot_financial_state SET attempt_token=?,updated_at=?
        WHERE order_id=? AND attempt_token IS NULL
        AND state IN ('PENDING_ORDER','BANK_SETTLEMENT_VERIFIED','RECONCILED','ADMIN_APPROVED','LEGACY_REVIEW')
        AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')
        AND EXISTS(SELECT 1 FROM manual_pilot_settlements s
          WHERE s.order_id=manual_pilot_financial_state.order_id AND s.org_id=manual_pilot_financial_state.org_id
          AND s.status IN ('pending_manual_payment','under_review'))`)
        .bind(token, now, params.orderId, params.adminId),
      rawDb.prepare(`UPDATE manual_pilot_settlements SET status='rejected',reconciled_by_admin_id=?,
        reconciled_at=?,audit_notes=?,updated_at=? WHERE order_id=?
        AND EXISTS(SELECT 1 FROM manual_pilot_financial_state WHERE ${guard})`)
        .bind(params.adminId, now, params.auditNotes ?? null, now, params.orderId, params.orderId, token),
      rawDb.prepare(`UPDATE pending_orders SET status='failed' WHERE order_id=? AND status='pending'
        AND EXISTS(SELECT 1 FROM manual_pilot_financial_state WHERE ${guard})`)
        .bind(params.orderId, params.orderId, token),
      rawDb.prepare(`INSERT INTO manual_pilot_financial_events
        (id,order_id,from_state,to_state,actor_id,evidence_id,created_at)
        SELECT ?,order_id,state,'REJECTED',?,evidence_id,? FROM manual_pilot_financial_state WHERE ${guard}`)
        .bind(eventId, params.adminId, now, params.orderId, token),
      rawDb.prepare(`INSERT INTO manual_pilot_audit_log
        (id,settlement_id,order_id,action,actor_admin_id,actor_role,metadata_json,created_at)
        SELECT ?,s.id,s.order_id,'rejected',?,'admin',?,? FROM manual_pilot_settlements s
        JOIN manual_pilot_financial_state f USING(order_id) WHERE f.order_id=? AND f.attempt_token=?`)
        .bind(auditId, params.adminId, JSON.stringify({ auditNotes: params.auditNotes ?? null }), now, params.orderId, token),
      rawDb.prepare(`UPDATE manual_pilot_financial_state SET state=CASE WHEN
        EXISTS(SELECT 1 FROM manual_pilot_settlements s WHERE s.order_id=manual_pilot_financial_state.order_id
          AND s.org_id=manual_pilot_financial_state.org_id AND s.status='rejected'
          AND s.reconciled_by_admin_id=? AND s.reconciled_at=?)
        AND NOT EXISTS(SELECT 1 FROM pending_orders p
          WHERE p.order_id=manual_pilot_financial_state.order_id AND p.status='pending')
        AND EXISTS(SELECT 1 FROM manual_pilot_financial_events WHERE id=? AND order_id=? AND to_state='REJECTED')
        AND EXISTS(SELECT 1 FROM manual_pilot_audit_log WHERE id=? AND order_id=? AND action='rejected')
        THEN 'REJECTED' ELSE NULL END,attempt_token=NULL WHERE ${guard}`)
        .bind(params.adminId, now, eventId, params.orderId, auditId, params.orderId, params.orderId, token),
      requirePilotClaimReleased(rawDb, params.orderId, token),
    ]);
    if (claim.meta.changes !== 1) {
      return failure({ code: 'INVALID_STATE', message: 'Rejection requires a compatible pending state and current admin' });
    }
    const updated = await getManualPilotSettlementByOrderId(rawDb, params.orderId, { adminId: params.adminId });
    return updated ? success(updated) : failure({ code: 'DB_ERROR', message: 'Rejected settlement could not be reloaded' });
  } catch {
    return failure({ code: 'DB_ERROR', message: 'Rejection transaction rolled back' });
  }
}
