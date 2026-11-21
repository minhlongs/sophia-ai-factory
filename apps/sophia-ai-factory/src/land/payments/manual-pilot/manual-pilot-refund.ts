/** Manual pilot refund intake. Only authoritative outbound evidence can settle a refund. */
import type { D1Database } from '@cloudflare/workers-types';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import { success, failure, type Result } from '@/seed/types/result';
import { manualPilotCalendarDeadlineMs } from './manual-pilot-delivery-evidence';
import { getManualPilotSettlementByOrderId } from './manual-pilot-repo';
import type { ManualPilotRefundIntake } from './manual-pilot-refund-intake';
import type { ManualPilotError, ManualPilotSettlement } from './types';

export interface RequestManualRefundParams {
  orderId: string;
  adminId: string;
  reason: string;
  category: 'goodwill_7d' | 'delivery_failure_14d';
  refundAmountVnd: number;
  deliveryEvidenceId?: string;
  intakeId?: string;
  auditNotes?: string;
  nowMs?: number;
}

export interface ConfirmManualRefundParams {
  orderId: string;
  adminId: string;
  refundExternalRef: string;
  auditNotes?: string;
  nowMs?: number;
}

export async function requestManualPilotRefund(
  rawDb: D1Database,
  params: RequestManualRefundParams,
): Promise<Result<ManualPilotSettlement, ManualPilotError>> {
  try {
    const nowMs = params.nowMs ?? Date.now();
    if (!Number.isFinite(nowMs) || !Number.isFinite(new Date(nowMs).getTime()) ||
      !['goodwill_7d', 'delivery_failure_14d'].includes(params.category)) {
      return failure({ code: 'VALIDATION_ERROR', message: 'Valid refund category and request time required' });
    }
    const nowIso = new Date(nowMs).toISOString();
    const settlement = await getManualPilotSettlementByOrderId(rawDb, params.orderId, { adminId: params.adminId });
    if (!settlement) return failure({ code: 'NOT_FOUND', message: 'Manual pilot order not found or unauthorized' });
    if (settlement.status !== 'activated' || settlement.sku_code !== OPTION_A_PILOT_CONTRACT.skuCode) {
      return failure({ code: 'INVALID_STATE', message: 'Refund requires an activated Option A pilot order' });
    }
    const delivery = params.category === 'delivery_failure_14d';
    // A category or requester narrative is not a verified delivery failure.
    if (delivery && !params.deliveryEvidenceId) {
      return failure({ code: 'INVALID_STATE', message: 'Verified Option A delivery failure evidence required' });
    }
    const maxWindowDays = {
      goodwill_7d: OPTION_A_PILOT_CONTRACT.refundPolicy.pilotGoodwillWindowDays,
      delivery_failure_14d: OPTION_A_PILOT_CONTRACT.refundPolicy.pilotDeliveryFailureWindowDays,
    }[params.category];
    const intake = params.intakeId ? await rawDb.prepare(`SELECT * FROM manual_pilot_refund_intakes
      WHERE id=? AND order_id=? AND org_id=? AND user_id=? AND category=?`)
      .bind(params.intakeId, settlement.order_id, settlement.org_id, settlement.user_id, params.category)
      .first<ManualPilotRefundIntake>() : null;
    if (!intake) return failure({ code: 'INVALID_STATE', message: 'Matching customer intake required' });
    const receivedMs = Date.parse(intake.received_at);
    const activatedMs = settlement.activated_at ? Date.parse(settlement.activated_at) : NaN;
    if (!Number.isFinite(activatedMs) || !Number.isFinite(receivedMs) || receivedMs < activatedMs || receivedMs > nowMs ||
      receivedMs > manualPilotCalendarDeadlineMs(activatedMs, maxWindowDays)) {
      return failure({ code: 'REFUND_WINDOW_EXCEEDED', message: `Refund window of ${maxWindowDays} calendar days has elapsed` });
    }
    const paidVnd = settlement.received_amount_vnd;
    if (paidVnd === null || !Number.isSafeInteger(paidVnd) || paidVnd <= 0) {
      return failure({ code: 'INVALID_STATE', message: 'Verified original collection required' });
    }
    if (!Number.isSafeInteger(params.refundAmountVnd) || params.refundAmountVnd !== paidVnd) {
      return failure({ code: 'AMOUNT_MISMATCH', message: 'Refund must equal the verified original collection' });
    }
    const refundId = `mpr_${crypto.randomUUID()}`;
    const auditId = `mpa_${crypto.randomUUID()}`;
    const metadata = JSON.stringify({ intakeId: intake.id, receivedAt: intake.received_at, refundId, category: params.category, refundAmountVnd: paidVnd,
      reason: params.reason, deliveryEvidenceId: delivery ? params.deliveryEvidenceId : null,
      policyTimezone: OPTION_A_PILOT_CONTRACT.timezone, policyWindowDays: maxWindowDays,
      policyVersion: OPTION_A_PILOT_CONTRACT.termsVersion });
    const guard = "EXISTS(SELECT 1 FROM manual_pilot_settlements WHERE order_id=? AND status='refund_pending' AND refund_id=?)";
    const deliveryGuard = delivery ? `AND EXISTS(SELECT 1 FROM manual_pilot_delivery_evidence d
      JOIN manual_pilot_financial_events v ON v.id=d.audit_event_id AND v.order_id=d.order_id
        AND v.evidence_id=d.id AND v.to_state='DELIVERY_FAILURE_VERIFIED'
        AND v.actor_id=d.verified_by_admin_id AND v.created_at=d.verified_at
      WHERE d.id=?11 AND d.order_id=manual_pilot_settlements.order_id
        AND d.org_id=manual_pilot_settlements.org_id AND d.attribution='sophia'
        AND d.scope IN ('option_a_campaign','option_a_script')
        AND d.policy_timezone='Asia/Saigon' AND d.policy_window_days=14
        AND d.occurred_at>=?12 AND d.occurred_at<=?14
        AND d.verified_at>=d.occurred_at AND d.verified_at<=?5)` : '';
    const update = rawDb.prepare(`UPDATE manual_pilot_settlements
      SET status='refund_pending',refund_id=?1,refund_amount_vnd=?2,refund_reason=?3,
        refund_requested_by=?4,refund_requested_at=?5,audit_notes=COALESCE(?6,audit_notes),updated_at=?5
      WHERE order_id=?7 AND status='activated' AND received_amount_vnd=?2
        AND org_id=?8 AND sku_code=?9 AND activated_at=?10
        AND EXISTS(SELECT 1 FROM manual_pilot_refund_intakes i
          WHERE i.id=?13 AND i.order_id=manual_pilot_settlements.order_id
            AND i.org_id=manual_pilot_settlements.org_id AND i.user_id=manual_pilot_settlements.user_id
            AND i.category=?15 AND i.received_at=?14)
        AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=?4 AND role='admin')
        AND EXISTS(SELECT 1 FROM manual_pilot_financial_state f
          JOIN manual_pilot_bank_evidence e ON e.id=f.evidence_id
          WHERE f.order_id=manual_pilot_settlements.order_id AND f.state='ACTIVE_14D'
            AND f.org_id=manual_pilot_settlements.org_id
            AND e.order_id=f.order_id AND e.org_id=f.org_id AND e.direction='inbound'
            AND e.currency='VND' AND e.amount_vnd=?2
            AND e.order_reference=manual_pilot_settlements.transfer_reference) ${deliveryGuard}`);
    const values = [refundId, paidVnd, `[${params.category}] ${params.reason}`, params.adminId,
      nowIso, params.auditNotes ?? null, settlement.order_id, settlement.org_id,
      OPTION_A_PILOT_CONTRACT.skuCode, settlement.activated_at];
    const [res] = await rawDb.batch([
      update.bind(...values, delivery ? params.deliveryEvidenceId : null, new Date(activatedMs).toISOString(),
        intake.id, intake.received_at, params.category),
      rawDb.prepare(`INSERT INTO manual_pilot_audit_log
        (id,settlement_id,order_id,action,actor_admin_id,actor_role,metadata_json,created_at)
        SELECT ?,?,?,'refund_requested',?,'admin',?,? WHERE ${guard}`)
        .bind(auditId, settlement.id, settlement.order_id, params.adminId, metadata, nowIso, settlement.order_id, refundId),
      rawDb.prepare(`INSERT INTO manual_pilot_refund_state(order_id,state,amount_vnd,category,requested_at,updated_at,intake_id)
        SELECT order_id,'REQUESTED',refund_amount_vnd,?,?,?,? FROM manual_pilot_settlements
        WHERE order_id=? AND refund_id=? AND status='refund_pending'`)
        .bind(params.category, nowIso, nowIso, intake.id, params.orderId, refundId),
      // Missing mandatory effects must fail INSIDE the batch, not after commit.
      rawDb.prepare(`SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM manual_pilot_settlements WHERE refund_id=?1)
        OR EXISTS(SELECT 1 FROM manual_pilot_settlements s JOIN manual_pilot_refund_state r USING(order_id)
          JOIN manual_pilot_audit_log a ON a.id=?2 AND a.order_id=s.order_id AND a.settlement_id=s.id
          WHERE s.refund_id=?1 AND s.status='refund_pending' AND s.order_id=?3
            AND s.refund_requested_by=?4 AND s.refund_requested_at=?5 AND s.refund_amount_vnd=?6
            AND r.state='REQUESTED' AND r.amount_vnd=?6 AND r.category=?7 AND r.requested_at=?5 AND r.intake_id=?9
            AND a.action='refund_requested' AND a.actor_admin_id=?4 AND a.actor_role='admin'
            AND a.created_at=?5 AND a.metadata_json=?8)
        THEN 'true' ELSE 'missing mandatory refund effect' END)`)
        .bind(refundId, auditId, params.orderId, params.adminId, nowIso, paidVnd, params.category, metadata, intake.id),
    ]);
    if ((res.meta?.changes ?? 0) !== 1) {
      return failure({ code: 'INVALID_STATE', message: 'Refund authorization, delivery evidence or order changed' });
    }
    const updated = await getManualPilotSettlementByOrderId(rawDb, params.orderId, { adminId: params.adminId });
    return updated ? success(updated) : failure({ code: 'DB_ERROR', message: 'Updated refund settlement not found' });
  } catch {
    return failure({ code: 'DB_ERROR', message: 'Refund request transaction rolled back' });
  }
}

export async function confirmManualPilotRefund(
  rawDb: D1Database,
  params: ConfirmManualRefundParams,
): Promise<Result<ManualPilotSettlement, ManualPilotError>> {
  // Typed bank reference strings cannot prove an independently verified debit.
  void rawDb;
  void params;
  return failure({ code: 'INVALID_STATE', message: 'Independent outgoing bank evidence and TRANSFER_PENDING state required' });
}
