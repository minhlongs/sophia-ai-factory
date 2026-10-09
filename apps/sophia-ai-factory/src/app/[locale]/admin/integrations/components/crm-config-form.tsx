import React from 'react';
import type { CrmProvider } from '@/tree/integrations/types';

interface CrmConfigFormProps {
  isVi: boolean;
  isPending: boolean;
  selectedProvider: CrmProvider;
  setSelectedProvider: (provider: CrmProvider) => void;
  syncDirection: 'bidirectional' | 'inbound' | 'outbound';
  setSyncDirection: (dir: 'bidirectional' | 'inbound' | 'outbound') => void;
  crmEndpoint: string;
  setCrmEndpoint: (val: string) => void;
  crmClientId: string;
  setCrmClientId: (val: string) => void;
  onSave: () => void;
}

export function CrmConfigForm({
  isVi,
  isPending,
  selectedProvider,
  setSelectedProvider,
  syncDirection,
  setSyncDirection,
  crmEndpoint,
  setCrmEndpoint,
  crmClientId,
  setCrmClientId,
  onSave,
}: CrmConfigFormProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
      <h3 className="text-base font-semibold text-white">
        {isVi ? 'Cấu Hình Kết Nối CRM Doanh Nghiệp' : 'Configure Enterprise CRM Connector'}
      </h3>
      <p className="mt-1 text-xs text-zinc-400">
        {isVi
          ? 'Thiết lập thông tin xác thực OAuth2 hoặc API key cho Salesforce / HubSpot.'
          : 'Enter OAuth2 endpoint and client credentials for Salesforce or HubSpot.'}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-300">
            {isVi ? 'Nhà Cung Cấp CRM' : 'CRM Provider'}
          </label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as CrmProvider)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none"
          >
            <option value="salesforce">Salesforce Enterprise</option>
            <option value="hubspot">HubSpot Professional / Enterprise</option>
            <option value="zapier">Zapier Automation Bus</option>
            <option value="custom">Custom Webhook Integration</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300">
            {isVi ? 'Hướng Đồng Bộ' : 'Sync Direction'}
          </label>
          <select
            value={syncDirection}
            onChange={(e) => setSyncDirection(e.target.value as 'bidirectional' | 'inbound' | 'outbound')}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none"
          >
            <option value="bidirectional">{isVi ? 'Hai chiều (Bidirectional)' : 'Bidirectional'}</option>
            <option value="inbound">{isVi ? 'Chỉ Nhận (Inbound only)' : 'Inbound only'}</option>
            <option value="outbound">{isVi ? 'Chỉ Gửi (Outbound only)' : 'Outbound only'}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300">
            {isVi ? 'API Endpoint URL' : 'API Endpoint URL'}
          </label>
          <input
            type="text"
            placeholder="https://company.my.salesforce.com"
            value={crmEndpoint}
            onChange={(e) => setCrmEndpoint(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300">
            {isVi ? 'Client ID / App ID' : 'Client ID / App ID'}
          </label>
          <input
            type="text"
            placeholder="3MVG9..."
            value={crmClientId}
            onChange={(e) => setCrmClientId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onSave}
          disabled={isPending}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition disabled:opacity-50"
        >
          {isVi ? 'Lưu Cấu Hình' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
