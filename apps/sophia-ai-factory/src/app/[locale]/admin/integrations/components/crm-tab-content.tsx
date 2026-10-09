import React from 'react';
import type { EnterpriseCrmConfig, CrmSyncEvent, CrmProvider } from '@/tree/integrations/types';
import { CrmConnectorCards } from './crm-connector-cards';
import { CrmConfigForm } from './crm-config-form';
import { CrmSyncEventsTable } from './crm-sync-events-table';

interface CrmTabContentProps {
  isVi: boolean;
  isPending: boolean;
  configs: EnterpriseCrmConfig[];
  syncEvents: CrmSyncEvent[];
  selectedProvider: CrmProvider;
  setSelectedProvider: (provider: CrmProvider) => void;
  syncDirection: 'bidirectional' | 'inbound' | 'outbound';
  setSyncDirection: (dir: 'bidirectional' | 'inbound' | 'outbound') => void;
  crmEndpoint: string;
  setCrmEndpoint: (val: string) => void;
  crmClientId: string;
  setCrmClientId: (val: string) => void;
  onTriggerSync: (provider: CrmProvider) => void;
  onSaveConfig: () => void;
}

export function CrmTabContent({
  isVi,
  isPending,
  configs,
  syncEvents,
  selectedProvider,
  setSelectedProvider,
  syncDirection,
  setSyncDirection,
  crmEndpoint,
  setCrmEndpoint,
  crmClientId,
  setCrmClientId,
  onTriggerSync,
  onSaveConfig,
}: CrmTabContentProps) {
  return (
    <div className="space-y-6">
      <CrmConnectorCards
        isVi={isVi}
        isPending={isPending}
        configs={configs}
        onTriggerSync={onTriggerSync}
      />

      <CrmConfigForm
        isVi={isVi}
        isPending={isPending}
        selectedProvider={selectedProvider}
        setSelectedProvider={setSelectedProvider}
        syncDirection={syncDirection}
        setSyncDirection={setSyncDirection}
        crmEndpoint={crmEndpoint}
        setCrmEndpoint={setCrmEndpoint}
        crmClientId={crmClientId}
        setCrmClientId={setCrmClientId}
        onSave={onSaveConfig}
      />

      <CrmSyncEventsTable isVi={isVi} syncEvents={syncEvents} />
    </div>
  );
}
