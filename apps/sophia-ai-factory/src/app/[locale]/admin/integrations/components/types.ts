import type { EnterpriseCrmConfig, CrmSyncEvent, WebhookSubscription, WebhookDeliveryLog } from '@/tree/integrations/types';

export interface IntegrationsPortalClientProps {
  initialConfigs: EnterpriseCrmConfig[];
  initialSyncEvents: CrmSyncEvent[];
  initialSubscriptions: WebhookSubscription[];
  initialDeliveryLogs: WebhookDeliveryLog[];
  tenantId: string;
  locale: 'en' | 'vi';
}

export type IntegrationTab = 'crm' | 'webhooks' | 'logs' | 'policy';

export interface StatusMessage {
  type: 'success' | 'error';
  text: string;
}

export interface TestPingState {
  status: 'testing' | 'success' | 'error';
  http?: number;
}
