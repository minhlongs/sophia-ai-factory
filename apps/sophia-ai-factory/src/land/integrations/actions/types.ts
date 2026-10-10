/**
 * Integration Server Action Types & Data Contracts
 *
 * Layer: land/integrations/actions
 *
 * @module land/integrations/actions/types
 */

import type {
  CrmProvider,
  CrmEntityType,
  EnterpriseCrmConfig,
  UpsertCrmConfigInput,
  CrmSyncEvent,
  WebhookSubscription,
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
  WebhookDeliveryLog,
  SophiaDealSnapshot,
} from '@/tree/integrations/types';

export type {
  CrmProvider,
  CrmEntityType,
  EnterpriseCrmConfig,
  UpsertCrmConfigInput,
  CrmSyncEvent,
  WebhookSubscription,
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
  WebhookDeliveryLog,
  SophiaDealSnapshot,
};

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
