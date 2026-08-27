/**
 * Inngest function: commerce payment-confirmed → fulfill digital product →
 * emit revenue event into the revenue-events pipeline.
 *
 * Orchestration only — order transitions and the idempotent fulfillment
 * insert (UNIQUE(order_id) + ON CONFLICT DO NOTHING) live in land/commerce
 * (forest→land orchestration exception).
 *
 * Idempotent end-to-end: a double IPN re-runs fulfillOrder, which no-ops on
 * an already-fulfilled order (alreadyFulfilled=true), and the revenue event
 * dedupes by `commerce_{productId}_{orderId}` in the ingestion atomic lock.
 *
 * Failure semantics: WRITE_FAILED and ORDER_NOT_PAID throw so Inngest
 * retries (the paid transition may lag the IPN); ORDER_NOT_FOUND is terminal
 * for this delivery and returned, not thrown.
 *
 * @module forest/inngest/functions/commerce-fulfillment
 */
import { inngest } from '@/seed/inngest/client';
import { fulfillOrder } from '@/land/commerce/digital-fulfillment';
import { buildCommerceEventId } from '@/land/commerce/commerce-order';
import { logger } from '@/seed/utils/logger-utility';

export const commerceFulfillment = inngest.createFunction(
  { id: 'commerce-fulfillment', retries: 2 },
  { event: 'commerce/payment.confirmed' },
  async ({ event, step }) => {
    const { orderId, productId, workspaceId, paymentId, amountCents, currency } = event.data;

    const fulfilled = await step.run('fulfill-order', () => fulfillOrder(orderId));

    if (!fulfilled.ok) {
      if (fulfilled.error.code === 'ORDER_NOT_FOUND') {
        logger.error('[commerce-fulfillment] Terminal: order not found', { orderId });
        return {
          ok: false,
          orderId,
          code: fulfilled.error.code,
          message: fulfilled.error.message,
        };
      }
      // WRITE_FAILED, DB_UNAVAILABLE or ORDER_NOT_PAID (event raced the
      // IPN's paid transition) — transient; retry via Inngest.
      throw new Error(
        `commerce fulfillment failed (${fulfilled.error.code}): ${fulfilled.error.message}`,
      );
    }

    // Emit even when alreadyFulfilled: a prior run may have fulfilled but
    // crashed before emitting; the ingestion lock dedupes re-emissions.
    const externalId = buildCommerceEventId(productId, orderId);
    await step.run('emit-revenue-event', () =>
      inngest.send({
        name: 'revenue/event.recorded',
        data: {
          source: 'commerce',
          externalId,
          amountCents,
          currency,
          workspaceId,
          recordedAtMs: Date.now(),
          metadata: { orderId, paymentId },
        },
      }),
    );

    return {
      ok: true,
      orderId,
      granted: !fulfilled.value.alreadyFulfilled,
      fulfillmentId: fulfilled.value.fulfillmentId,
      revenueExternalId: externalId,
    };
  },
);
