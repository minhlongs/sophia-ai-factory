/**
 * Inngest Background Function: Growth v12 Webhook Normalization Worker
 * Ingests external affiliate conversion webhooks and publishes normalized conversion events.
 * Layer: forest/growth | Max LOC: < 200 | Zero :any
 * @module forest/growth/growth-v12-webhook-worker
 */

import { inngest } from '@/seed/inngest/client';
import { affiliateConversionWebhookSchema } from '@/seed/types/growth-triad-v12';
import { logger } from '@/seed/utils/logger-utility';

export const growthV12WebhookWorker = inngest.createFunction(
  { id: 'growth-v12-webhook-worker', name: 'Growth v12 Webhook Worker' },
  { event: 'growth/v12.webhook.received' },
  async ({ event, step }) => {
    const parsed = affiliateConversionWebhookSchema.safeParse(event.data);
    if (!parsed.success) {
      logger.error('Invalid affiliate conversion webhook received', { errors: parsed.error.issues });
      return { success: false, reason: 'INVALID_WEBHOOK' };
    }

    const payload = parsed.data;

    await step.run('publish-normalized-conversion', async () => {
      logger.info('Normalized affiliate conversion received', {
        network: payload.affiliateNetwork,
        externalOrderId: payload.externalOrderId,
        commission: payload.commissionAmountUsd,
      });

      await inngest.send({
        name: 'conversion.created',
        data: {
          conversionEventId: payload.externalOrderId,
          tenantId: 'default',
        },
      });
    });

    return {
      success: true,
      externalOrderId: payload.externalOrderId,
    };
  },
);
