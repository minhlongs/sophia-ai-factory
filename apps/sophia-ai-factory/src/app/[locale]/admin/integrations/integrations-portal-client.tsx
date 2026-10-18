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
import { IntegrationsStatusBanner } from './integrations-status-banner';

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

  const portal = useIntegrationsPortal({
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

      <IntegrationsStatusBanner statusMessage={portal.statusMessage} />

      <TabNavigation
        isVi={isVi}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        subscriptionsCount={portal.subscriptions.length}
        deliveryLogsCount={portal.deliveryLogs.length}
      />

      {activeTab === 'crm' && (
        <CrmTabContent
          isVi={isVi}
          isPending={portal.isPending}
          configs={portal.configs}
          syncEvents={portal.syncEvents}
          selectedProvider={portal.selectedProvider}
          setSelectedProvider={portal.setSelectedProvider}
          crmEndpoint={portal.crmEndpoint}
          setCrmEndpoint={portal.setCrmEndpoint}
          crmClientId={portal.crmClientId}
          setCrmClientId={portal.setCrmClientId}
          syncDirection={portal.syncDirection}
          setSyncDirection={portal.setSyncDirection}
          onTriggerSync={portal.handleTriggerSync}
          onSaveConfig={portal.handleSaveCrmConfig}
        />
      )}

      {activeTab === 'webhooks' && (
        <WebhooksTabContent
          isVi={isVi}
          isPending={portal.isPending}
          subscriptions={portal.subscriptions}
          newSubUrl={portal.newSubUrl}
          setNewSubUrl={portal.setNewSubUrl}
          newSubSecret={portal.newSubSecret}
          setNewSubSecret={portal.setNewSubSecret}
          newSubDesc={portal.newSubDesc}
          setNewSubDesc={portal.setNewSubDesc}
          selectedEvents={portal.selectedEvents}
          setSelectedEvents={portal.setSelectedEvents}
          testResult={portal.testResult}
          onTestPing={portal.handleTestPing}
          onCreateSubscription={portal.handleCreateSubscription}
        />
      )}

      {activeTab === 'logs' && (
        <DeliveryLogsTable isVi={isVi} deliveryLogs={portal.deliveryLogs} />
      )}

      {activeTab === 'policy' && <PoliciesSecurityTab isVi={isVi} />}
    </div>
  );
}
