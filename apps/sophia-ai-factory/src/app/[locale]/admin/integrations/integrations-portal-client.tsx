'use client';

/**
 * Enterprise Integrations Portal Client
 *
 * Thin composition facade connecting:
 * - Salesforce, HubSpot, Zapier & Custom CRM connectors.
 * - Real-time CRM synchronization triggers and event timeline.
 * - Webhook subscriptions, Web Crypto HMAC-SHA256 test pings, and delivery logs.
 * - Sophia Authority Bias and LWW conflict resolution policies.
 *
 * Layer: land (Admin UI Client Component)
 *
 * @module app/[locale]/admin/integrations/integrations-portal-client
 */

import React, { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import {
  type IntegrationsPortalClientProps,
  type IntegrationTab,
  useIntegrationsPortal,
  PortalHeader,
  TabNavigation,
  CrmTabContent,
  WebhooksTabContent,
  DeliveryLogsTable,
  PoliciesSecurityTab,
} from './components';

export function IntegrationsPortalClient({
  initialConfigs,
  initialSyncEvents,
  initialSubscriptions,
  initialDeliveryLogs,
  tenantId,
  locale,
}: IntegrationsPortalClientProps) {
  const isVi = locale === 'vi';
  const [activeTab, setActiveTab] = useState<IntegrationTab>('crm');

  const {
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
  } = useIntegrationsPortal({
    initialConfigs,
    initialSyncEvents,
    initialSubscriptions,
    initialDeliveryLogs,
    tenantId,
    isVi,
  });

  return (
    <div className="space-y-6">
      <PortalHeader isVi={isVi} />

      {statusMessage && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
              : 'bg-red-950/50 border-red-800 text-red-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <TabNavigation
        isVi={isVi}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        subscriptionsCount={subscriptions.length}
        deliveryLogsCount={deliveryLogs.length}
      />

      {activeTab === 'crm' && (
        <CrmTabContent
          isVi={isVi}
          isPending={isPending}
          configs={configs}
          syncEvents={syncEvents}
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
          crmEndpoint={crmEndpoint}
          setCrmEndpoint={setCrmEndpoint}
          crmClientId={crmClientId}
          setCrmClientId={setCrmClientId}
          syncDirection={syncDirection}
          setSyncDirection={setSyncDirection}
          onTriggerSync={handleTriggerSync}
          onSaveConfig={handleSaveCrmConfig}
        />
      )}

      {activeTab === 'webhooks' && (
        <WebhooksTabContent
          isVi={isVi}
          isPending={isPending}
          subscriptions={subscriptions}
          newSubUrl={newSubUrl}
          setNewSubUrl={setNewSubUrl}
          newSubSecret={newSubSecret}
          setNewSubSecret={setNewSubSecret}
          newSubDesc={newSubDesc}
          setNewSubDesc={setNewSubDesc}
          selectedEvents={selectedEvents}
          setSelectedEvents={setSelectedEvents}
          testResult={testResult}
          onTestPing={handleTestPing}
          onCreateSubscription={handleCreateSubscription}
        />
      )}

      {activeTab === 'logs' && (
        <DeliveryLogsTable isVi={isVi} deliveryLogs={deliveryLogs} />
      )}

      {activeTab === 'policy' && <PoliciesSecurityTab isVi={isVi} />}
    </div>
  );
}
