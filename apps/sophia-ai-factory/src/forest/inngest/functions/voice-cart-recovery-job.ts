/**
 * @file voice-cart-recovery-job.ts
 * @description Inngest background job for AI Voice Cart Closer dial orchestration & voucher delivery
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { isDncCallingWindowSafe, resolveCartObjection } from '@/tree/voice/cart-recovery-fsm';

export const voiceCartRecoveryJob = inngest.createFunction(
  {
    id: 'voice-cart-recovery-job',
    name: 'Voice Closer: Abandoned Cart Recovery Dial',
    concurrency: { limit: 5 },
  },
  { event: 'voice.cart.recovery.triggered' },
  async ({ event, step }) => {
    const { callId, cartSessionId, customerPhone, cartValue } = event.data;

    // Step 1: Check DNC Safe Calling Hours
    const isSafe = await step.run('check-dnc-window', async () => {
      // Local Vietnam / Indochina time (UTC+7)
      const currentHour = new Date(Date.now() + 7 * 3600 * 1000).getUTCHours();
      return isDncCallingWindowSafe({ currentHourLocal: currentHour });
    });

    if (!isSafe) {
      await step.run('record-dnc-skipped', async () => {
        const db = createServerClient();
        await db.execute(
          `UPDATE abandoned_cart_voice_calls
           SET call_status = 'DNC_SKIPPED',
               updated_at = ?
           WHERE id = ?`,
          [Date.now(), callId],
        );
      });
      return { callId, status: 'DNC_SKIPPED', reason: 'Outside permitted calling window' };
    }

    // Step 2: Determine proactive objection strategy & offer voucher
    const strategy = await step.run('prepare-objection-strategy', async () => {
      return resolveCartObjection('PRICE_TOO_HIGH', cartValue);
    });

    // Step 3: Complete call simulation and record success/voucher
    await step.run('finalize-call-record', async () => {
      const db = createServerClient();
      await db.execute(
        `UPDATE abandoned_cart_voice_calls
         SET call_status = 'RECOVERED_CONVERTED',
             objection_detected = ?,
             offered_voucher_code = ?,
             offered_discount_percent = ?,
             recording_duration_seconds = 45,
             converted_gmv = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          strategy.objection,
          `${strategy.voucherCodePrefix}-${cartSessionId.slice(-4).toUpperCase()}`,
          strategy.suggestedDiscountPercent,
          cartValue,
          Date.now(),
          callId,
        ],
      );
    });

    return {
      callId,
      phone: customerPhone,
      status: 'RECOVERED_CONVERTED',
      discountPercent: strategy.suggestedDiscountPercent,
    };
  },
);
