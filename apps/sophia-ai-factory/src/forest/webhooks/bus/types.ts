/**
 * Types and constants for outbound webhook delivery bus.
 * @module forest/webhooks/bus/types
 */

export type {
  WebhookEndpoint,
  WebhookDelivery,
  WebhookEndpointRow,
} from '@/seed/types/outbound-webhooks';

export type { WebhookFetcher } from '@/tree/webhooks/delivery-service';

export const DEFAULT_MAX_ATTEMPTS = 5;
export const DEFAULT_BATCH_SIZE = 50;
