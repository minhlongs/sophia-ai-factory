import type { D1Database } from '@cloudflare/workers-types';
import { z } from 'zod';
import { failure, success, type Result } from '@/seed/types/result';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import type { ManualPilotError } from './types';

export const manualPilotRefundIntakeSchema = z.object({
  orderId: z.string().trim().min(3).max(128),
  orgId: z.string().trim().min(1).max(128),
  category: z.enum(['goodwill_7d', 'delivery_failure_14d']),
  reason: z.string().trim().min(5).max(500),
  beneficiaryBankIdentity: z.string().trim().min(1).max(128),
  beneficiaryAccountIdentity: z.string().trim().min(1).max(128),
}).strict();

export interface ManualPilotRefundIntake {
  id: string;
  order_id: string;
  org_id: string;
  user_id: string;
  category: 'goodwill_7d' | 'delivery_failure_14d';
  received_at: string;
}

/** The authenticated customer's instruction is immutable; retries return the original receipt. */
export async function receiveManualPilotRefundIntake(db: D1Database, input: unknown, userId: string)
  : Promise<Result<{ intakeId: string; receivedAt: string }, ManualPilotError>> {
  const parsed = manualPilotRefundIntakeSchema.safeParse(input);
  if (!parsed.success || !userId) return failure({ code: 'VALIDATION_ERROR', message: 'Valid customer refund instruction required' });
  const data = parsed.data;
  const id = `mpi_${crypto.randomUUID()}`;
  const receivedAt = new Date().toISOString();
  try {
    await db.prepare(`INSERT INTO manual_pilot_refund_intakes
      (id,order_id,org_id,user_id,category,reason,beneficiary_bank_identity,beneficiary_account_identity,received_at)
      SELECT ?,s.order_id,s.org_id,s.user_id,?,?,?,?,? FROM manual_pilot_settlements s
      JOIN manual_pilot_financial_state f USING(order_id)
      WHERE s.order_id=? AND s.org_id=? AND s.user_id=? AND s.sku_code=?
        AND s.status='activated' AND f.org_id=s.org_id AND f.state='ACTIVE_14D'
        AND EXISTS(SELECT 1 FROM org_members m WHERE m.org_id=s.org_id AND m.user_id=s.user_id)
        AND NOT EXISTS(SELECT 1 FROM manual_pilot_refund_intakes i WHERE i.order_id=s.order_id AND i.category=?)
      ON CONFLICT DO NOTHING`).bind(id, data.category, data.reason, data.beneficiaryBankIdentity,
      data.beneficiaryAccountIdentity, receivedAt, data.orderId, data.orgId, userId,
      OPTION_A_PILOT_CONTRACT.skuCode, data.category).run();
    const intake = await db.prepare(`SELECT i.id,i.received_at,i.reason,i.beneficiary_bank_identity,i.beneficiary_account_identity FROM manual_pilot_refund_intakes i
      JOIN manual_pilot_settlements s ON s.order_id=i.order_id AND s.user_id=i.user_id AND s.org_id=i.org_id
      WHERE i.order_id=? AND i.org_id=? AND i.user_id=? AND i.category=?
        AND EXISTS(SELECT 1 FROM org_members m WHERE m.user_id=i.user_id AND m.org_id=i.org_id)`)
      .bind(data.orderId, data.orgId, userId, data.category).first<{ id: string; received_at: string; reason: string; beneficiary_bank_identity: string; beneficiary_account_identity: string }>();
    if (intake && (intake.reason !== data.reason || intake.beneficiary_bank_identity !== data.beneficiaryBankIdentity
      || intake.beneficiary_account_identity !== data.beneficiaryAccountIdentity)) {
      return failure({ code: 'INVALID_STATE', message: 'Conflicting immutable refund instruction' });
    }
    return intake ? success({ intakeId: intake.id, receivedAt: intake.received_at })
      : failure({ code: 'NOT_FOUND', message: 'Eligible customer order not found' });
  } catch { return failure({ code: 'DB_ERROR', message: 'Unable to receive refund instruction' }); }
}
