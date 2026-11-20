import type { D1Database } from '@cloudflare/workers-types';
import { z } from 'zod';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import { failure, success, type Result } from '@/seed/types/result';
import type { ManualPilotError } from './types';

/** The recent-auth admin attests to reviewing this artifact; its digest is not
 * an automatic failure classifier or proof of an independent bank payment. */
export const manualPilotDeliveryVerificationSchema = z.object({
  action: z.literal('verify_delivery_failure'),
  intakeId: z.string().min(1).max(128).optional(),
  orderId: z.string().trim().min(3).max(128),
  orgId: z.string().trim().min(1).max(128),
  scope: z.enum(['option_a_campaign', 'option_a_script']),
  attribution: z.literal('sophia'),
  artifactRef: z.string().trim().min(3).max(500),
  artifactSha256: z.string().regex(/^[a-f0-9]{64}$/i).transform((digest) => digest.toLowerCase()),
  occurredAt: z.iso.datetime({ offset: true }),
});

/** Asia/Saigon is fixed UTC+7. Add local dates at the SAME local time, not
 * midnight or end-of-date. Inclusive anniversary; the next millisecond fails. */
export function manualPilotCalendarDeadlineMs(activatedMs: number, days: number): number {
  const local = new Date(activatedMs + 7 * 60 * 60 * 1000);
  local.setUTCDate(local.getUTCDate() + days);
  return local.getTime() - 7 * 60 * 60 * 1000;
}

export async function verifyManualPilotDeliveryFailure(
  db: D1Database,
  input: z.input<typeof manualPilotDeliveryVerificationSchema>,
  adminId: string,
): Promise<Result<{ evidenceId: string }, ManualPilotError>> {
  const parsed = manualPilotDeliveryVerificationSchema.safeParse(input);
  if (!parsed.success || !adminId) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Structured Option A verification required' });
  }
  const data = parsed.data;
  const nowMs = Date.now();
  const occurredMs = Date.parse(data.occurredAt);
  if (!Number.isFinite(occurredMs) || occurredMs > nowMs) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Invalid or future delivery failure occurrence' });
  }
  try {
    const now = new Date(nowMs).toISOString();
    const order = await db.prepare(`SELECT s.activated_at FROM manual_pilot_settlements s
      JOIN manual_pilot_financial_state f USING(order_id)
      WHERE s.order_id=? AND s.org_id=? AND f.org_id=s.org_id AND s.status='activated'
      AND f.state='ACTIVE_14D' AND s.sku_code=?
      AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')`)
      .bind(data.orderId, data.orgId, OPTION_A_PILOT_CONTRACT.skuCode, adminId)
      .first<{ activated_at: string }>();
    const activatedMs = order ? Date.parse(order.activated_at) : NaN;
    const deadline = manualPilotCalendarDeadlineMs(activatedMs,
      OPTION_A_PILOT_CONTRACT.refundPolicy.pilotDeliveryFailureWindowDays);
    const intake = data.intakeId ? await db.prepare(`SELECT i.received_at FROM manual_pilot_refund_intakes i
      JOIN manual_pilot_settlements s ON s.order_id=i.order_id AND s.user_id=i.user_id AND s.org_id=i.org_id
      WHERE i.id=? AND i.order_id=? AND i.org_id=? AND i.category='delivery_failure_14d'`)
      .bind(data.intakeId, data.orderId, data.orgId).first<{ received_at: string }>() : null;
    const receivedMs = intake ? Date.parse(intake.received_at) : nowMs;
    if ((data.intakeId && !intake) || !Number.isFinite(activatedMs) || !Number.isFinite(receivedMs) ||
      occurredMs < activatedMs || occurredMs > receivedMs || receivedMs > nowMs || receivedMs > deadline) {
      return failure({ code: 'INVALID_STATE', message: 'Current admin, active tenant pilot and timely Option A failure required' });
    }
    const id = `mpd_${crypto.randomUUID()}`;
    const eventId = crypto.randomUUID();
    const [insert] = await db.batch([
      db.prepare(`INSERT INTO manual_pilot_delivery_evidence
        (id,order_id,org_id,scope,attribution,artifact_ref,artifact_sha256,occurred_at,
         verified_by_admin_id,verified_at,audit_event_id,policy_timezone,policy_window_days,policy_version)
        SELECT ?,s.order_id,s.org_id,?,?,?,?,?,?,?,?,?,?,? FROM manual_pilot_settlements s
        JOIN manual_pilot_financial_state f USING(order_id)
        WHERE s.order_id=? AND s.org_id=? AND f.org_id=s.org_id AND s.sku_code=?
        AND s.status='activated' AND f.state='ACTIVE_14D' AND s.activated_at=?
        AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')`)
        .bind(id, data.scope, data.attribution, data.artifactRef, data.artifactSha256,
          new Date(occurredMs).toISOString(), adminId, now, eventId,
          OPTION_A_PILOT_CONTRACT.timezone, OPTION_A_PILOT_CONTRACT.refundPolicy.pilotDeliveryFailureWindowDays,
          OPTION_A_PILOT_CONTRACT.termsVersion, data.orderId, data.orgId, OPTION_A_PILOT_CONTRACT.skuCode,
          order?.activated_at ?? null, adminId),
      db.prepare(`INSERT INTO manual_pilot_financial_events
        (id,order_id,from_state,to_state,actor_id,evidence_id,created_at)
        SELECT audit_event_id,order_id,'ACTIVE_14D','DELIVERY_FAILURE_VERIFIED',verified_by_admin_id,id,verified_at
        FROM manual_pilot_delivery_evidence WHERE id=?`)
        .bind(id),
      // A SELECT error aborts the entire D1 batch, even when a trigger silently
      // ignored a mandatory write. Do not replace this with post-commit checks.
      db.prepare(`SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM manual_pilot_delivery_evidence WHERE id=?)
        OR EXISTS(SELECT 1 FROM manual_pilot_delivery_evidence d JOIN manual_pilot_financial_events e
          ON e.id=d.audit_event_id AND e.order_id=d.order_id AND e.evidence_id=d.id
          AND e.actor_id=d.verified_by_admin_id AND e.to_state='DELIVERY_FAILURE_VERIFIED'
          AND e.created_at=d.verified_at WHERE d.id=?) THEN 'true' ELSE 'missing delivery verification audit' END)`)
        .bind(id, id),
    ]);
    return insert.meta.changes === 1 ? success({ evidenceId: id })
      : failure({ code: 'INVALID_STATE', message: 'Delivery verification authorization or pilot changed' });
  } catch {
    return failure({ code: 'DB_ERROR', message: 'Delivery verification and audit could not be committed' });
  }
}
