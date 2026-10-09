'use client';

import { useState, useTransition } from 'react';
import type {
  EnterpriseCrmConfig,
  CrmSyncEvent,
  WebhookSubscription,
  WebhookDeliveryLog,
  CrmProvider,
} from '@/tree/integrations/types';
import type { StatusMessage, TestPingState } from './types';
import { createCrmHandlers } from './crm-actions-handlers';
import { createWebhookHandlers } from './webhook-actions-handlers';

interface UseIntegrationsPortalOptions {
  initialConfigs: EnterpriseCrmConfig[];
  initialSyncEvents: CrmSyncEvent[];
  initialSubscriptions: WebhookSubscription[];
  initialDeliveryLogs: WebhookDeliveryLog[];
  tenantId: string;
  isVi: boolean;
}

export function useIntegrationsPortal({
  initialConfigs,
  initialSyncEvents,
  initialSubscriptions,
  initialDeliveryLogs,
  tenantId,
  isVi,
}: UseIntegrationsPortalOptions) {
  const [configs, setConfigs] = useState<EnterpriseCrmConfig[]>(initialConfigs);
  const [syncEvents, setSyncEvents] = useState<CrmSyncEvent[]>(initialSyncEvents);
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>(initialSubscriptions);
  const [deliveryLogs] = useState<WebhookDeliveryLog[]>(initialDeliveryLogs);

  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  // New Subscription Form State
  const [newSubUrl, setNewSubUrl] = useState('');
  const [newSubSecret, setNewSubSecret] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['deal.won', 'contract.signed']);

  // CRM Config Form State
  const [selectedProvider, setSelectedProvider] = useState<CrmProvider>('salesforce');
  const [crmEndpoint, setCrmEndpoint] = useState('');
  const [crmClientId, setCrmClientId] = useState('');
  const [syncDirection, setSyncDirection] = useState<'bidirectional' | 'inbound' | 'outbound'>('bidirectional');

  // Test Ping State
  const [testResult, setTestResult] = useState<Record<string, TestPingState>>({});

  const { handleSaveCrmConfig, handleTriggerSync } = createCrmHandlers({
    tenantId,
    isVi,
    selectedProvider,
    crmEndpoint,
    crmClientId,
    syncDirection,
    startTransition,
    setConfigs,
    setSyncEvents,
    setStatusMessage,
  });

  const { handleTestPing, handleCreateSubscription } = createWebhookHandlers({
    tenantId,
    isVi,
    newSubUrl,
    setNewSubUrl,
    newSubSecret,
    setNewSubSecret,
    newSubDesc,
    setNewSubDesc,
    selectedEvents,
    startTransition,
    setSubscriptions,
    setTestResult,
    setStatusMessage,
  });

  return {
    configs,
    syncEvents,
    subscriptions,
    deliveryLogs,
    isPending,
    statusMessage,
    newSubUrl,
    setNewSubUrl,
    newSubSecret,
    setNewSubSecret,
    newSubDesc,
    setNewSubDesc,
    selectedEvents,
    setSelectedEvents,
    selectedProvider,
    setSelectedProvider,
    crmEndpoint,
    setCrmEndpoint,
    crmClientId,
    setCrmClientId,
    syncDirection,
    setSyncDirection,
    testResult,
    handleTestPing,
    handleSaveCrmConfig,
    handleTriggerSync,
    handleCreateSubscription,
  };
}
