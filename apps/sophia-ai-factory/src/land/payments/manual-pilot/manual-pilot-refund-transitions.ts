import type { D1Database } from '@cloudflare/workers-types';
import { failure, success } from '@/seed/types/result';
import { requirePilotEffect, requirePilotClaimReleased } from './manual-pilot-required-effects';

/** Outbound evidence must already have been independently ingested. */
export async function transitionPilotRefund(db:D1Database,input:{orderId:string;adminId:string;
  target:'APPROVED'|'TRANSFER_PENDING'|'SETTLED';evidenceId?:string}) {
  const previous={APPROVED:'REQUESTED',TRANSFER_PENDING:'APPROVED',SETTLED:'TRANSFER_PENDING'}[input.target];
  const token=crypto.randomUUID();
  const now=new Date().toISOString();
  try {
    const [claim]=await db.batch([
      db.prepare(`UPDATE manual_pilot_financial_state SET attempt_token=? WHERE order_id=? AND attempt_token IS NULL
        AND state='ACTIVE_14D' AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')
        AND EXISTS(SELECT 1 FROM manual_pilot_settlements s WHERE s.order_id=manual_pilot_financial_state.order_id
          AND s.org_id=manual_pilot_financial_state.org_id AND s.status IN ('activated','refund_pending'))
        AND EXISTS(SELECT 1 FROM manual_pilot_refund_state r WHERE r.order_id=? AND r.state=?
          AND (?!='SETTLED' OR EXISTS(SELECT 1 FROM manual_pilot_bank_evidence e
            JOIN manual_pilot_bank_counterparties c ON c.evidence_id=e.id
            JOIN manual_pilot_refund_intakes i ON i.id=r.intake_id AND i.order_id=r.order_id
              AND i.org_id=manual_pilot_financial_state.org_id AND i.category=r.category
            JOIN manual_pilot_settlements s ON s.order_id=i.order_id AND s.org_id=i.org_id AND s.user_id=i.user_id
            WHERE e.id=? AND e.order_id=r.order_id AND e.org_id=manual_pilot_financial_state.org_id
            AND e.direction='outbound' AND e.currency='VND' AND e.amount_vnd=r.amount_vnd
            AND e.order_reference=s.transfer_reference
            AND c.bank_identity=i.beneficiary_bank_identity AND c.account_identity=i.beneficiary_account_identity
            AND e.settled_at>=r.requested_at AND e.verified_at>=e.settled_at AND e.verified_at<=?
            AND e.settled_at>=i.received_at)))`)
        .bind(token,input.orderId,input.adminId,input.orderId,previous,input.target,input.evidenceId??null,now),
      db.prepare(`UPDATE manual_pilot_refund_state SET state=?,evidence_id=COALESCE(?,evidence_id),updated_at=?
        WHERE order_id=? AND EXISTS(SELECT 1 FROM manual_pilot_financial_state WHERE order_id=? AND attempt_token=?)`)
        .bind(input.target,input.target==='SETTLED'?input.evidenceId:null,now,input.orderId,input.orderId,token),
      requirePilotEffect(db,input.orderId,token),
      ...(input.target==='SETTLED' ? [
        db.prepare(`UPDATE manual_pilot_credit_grants SET revoked=granted-consumed WHERE order_id=?
          AND EXISTS(SELECT 1 FROM manual_pilot_financial_state f JOIN manual_pilot_settlements s USING(order_id)
            WHERE f.order_id=manual_pilot_credit_grants.order_id AND f.attempt_token=?
              AND f.org_id=manual_pilot_credit_grants.org_id AND s.user_id=manual_pilot_credit_grants.user_id)`)
          .bind(input.orderId,token),
        requirePilotEffect(db,input.orderId,token),
        db.prepare(`UPDATE manual_pilot_entitlements SET revoked_at=? WHERE order_id=?
          AND EXISTS(SELECT 1 FROM manual_pilot_financial_state f JOIN manual_pilot_settlements s USING(order_id)
            WHERE f.order_id=manual_pilot_entitlements.order_id AND f.attempt_token=?
              AND f.org_id=manual_pilot_entitlements.org_id AND s.user_id=manual_pilot_entitlements.user_id)`)
          .bind(now,input.orderId,token),
        requirePilotEffect(db,input.orderId,token),
        db.prepare(`UPDATE manual_pilot_settlements SET status='refunded',refund_confirmed_at=?,refund_confirmed_by=?
          WHERE order_id=? AND EXISTS(SELECT 1 FROM manual_pilot_financial_state WHERE order_id=? AND attempt_token=?)`)
          .bind(now,input.adminId,input.orderId,input.orderId,token),
        requirePilotEffect(db,input.orderId,token),
        db.prepare(`INSERT INTO manual_pilot_audit_log
          (id,settlement_id,order_id,action,actor_admin_id,actor_role,created_at)
          SELECT ?,s.id,s.order_id,'refund_confirmed',?,'admin',? FROM manual_pilot_settlements s
          JOIN manual_pilot_financial_state f USING(order_id) WHERE f.order_id=? AND f.attempt_token=?`)
          .bind(crypto.randomUUID(),input.adminId,now,input.orderId,token),
        requirePilotEffect(db,input.orderId,token),
      ] : []),
      db.prepare(`INSERT INTO manual_pilot_financial_events(id,order_id,from_state,to_state,actor_id,evidence_id,created_at)
        SELECT ?,order_id,?,?,?,?,? FROM manual_pilot_financial_state WHERE order_id=? AND attempt_token=?`)
        .bind(crypto.randomUUID(),previous,input.target,input.adminId,input.evidenceId??null,now,input.orderId,token),
      requirePilotEffect(db,input.orderId,token),
      db.prepare('UPDATE manual_pilot_financial_state SET attempt_token=NULL WHERE order_id=? AND attempt_token=?')
        .bind(input.orderId,token),
      requirePilotClaimReleased(db,input.orderId,token),
    ]);
    return claim.meta.changes===1 ? success({state:input.target}) : failure({code:'INVALID_STATE',message:'Refund authorization, evidence or previous state invalid'});
  } catch { return failure({code:'DB_ERROR',message:'Refund transition rolled back'}); }
}
