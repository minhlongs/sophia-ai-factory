import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import type { ManualPilotError } from './types';
import { requirePilotEffect, requirePilotClaimReleased } from './manual-pilot-required-effects';

export type PilotFinancialState = 'PENDING_ORDER' | 'BANK_SETTLEMENT_VERIFIED'
  | 'RECONCILED' | 'ADMIN_APPROVED' | 'ACTIVE_14D' | 'LEGACY_REVIEW' | 'REJECTED';

const prior = {
  BANK_SETTLEMENT_VERIFIED: 'PENDING_ORDER',
  RECONCILED: 'BANK_SETTLEMENT_VERIFIED',
  ADMIN_APPROVED: 'RECONCILED',
} as const;

/** Each legal transition and its audit event commit together. Activation has
 * additional mandatory effects and is deliberately not accepted here. */
export async function transitionManualPilot(
  db: D1Database,
  input: { orderId: string; orgId: string; adminId: string; evidenceId: string;
    target: keyof typeof prior },
): Promise<Result<{ state: PilotFinancialState }, ManualPilotError>> {
  const from = prior[input.target];
  if (!from) return failure({ code: 'INVALID_STATE', message: 'Unsupported financial transition' });
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    const [claim] = await db.batch([
      db.prepare(`UPDATE manual_pilot_financial_state SET state=?,evidence_id=?,attempt_token=?,updated_at=?
        WHERE order_id=? AND org_id=? AND state=? AND attempt_token IS NULL
        AND (evidence_id IS NULL OR evidence_id=?)
        AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')
        AND EXISTS (SELECT 1 FROM manual_pilot_bank_evidence e
          JOIN manual_pilot_settlements s ON s.order_id=e.order_id
          WHERE e.id=? AND e.order_id=manual_pilot_financial_state.order_id
          AND e.org_id=manual_pilot_financial_state.org_id AND s.org_id=manual_pilot_financial_state.org_id
          AND s.status IN ('pending_manual_payment','under_review') AND e.direction='inbound'
          AND e.amount_vnd=s.expected_amount_vnd AND e.currency='VND'
          AND e.order_reference=s.transfer_reference)`)
        .bind(input.target,input.evidenceId,token,now,input.orderId,input.orgId,from,
          input.evidenceId,input.adminId,input.evidenceId),
      db.prepare(`INSERT INTO manual_pilot_financial_events
        (id,order_id,from_state,to_state,actor_id,evidence_id,created_at)
        SELECT ?,order_id,?,?,?,evidence_id,? FROM manual_pilot_financial_state
        WHERE order_id=? AND attempt_token=?`)
        .bind(crypto.randomUUID(),from,input.target,input.adminId,now,input.orderId,token),
      requirePilotEffect(db,input.orderId,token),
      db.prepare('UPDATE manual_pilot_financial_state SET attempt_token=NULL WHERE order_id=? AND attempt_token=?')
        .bind(input.orderId,token),
      requirePilotClaimReleased(db,input.orderId,token),
    ]);
    if (claim.meta.changes !== 1) return failure({ code: 'INVALID_STATE', message: 'Transition authorization, evidence or prior state invalid' });
    return success({ state: input.target });
  } catch {
    return failure({ code: 'DB_ERROR', message: 'Financial transition rolled back' });
  }
}
