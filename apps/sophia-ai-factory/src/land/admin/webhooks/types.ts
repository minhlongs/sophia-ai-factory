/**
 * Webhook Admin Actions Type Definitions
 *
 * Layer: land/admin/webhooks
 */

import type { CreateWebhookEndpointInput } from '@/seed/types/outbound-webhooks';

export interface ActionError {
  code: string;
  message: string;
}

export interface CreateWebhookActionInput extends CreateWebhookEndpointInput {
  orgId: string;
}
