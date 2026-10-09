import React from 'react';
import { ArrowRightLeft, Webhook, Clock, ShieldCheck } from 'lucide-react';
import type { IntegrationTab } from './types';

interface TabNavigationProps {
  isVi: boolean;
  activeTab: IntegrationTab;
  onTabChange: (tab: IntegrationTab) => void;
  subscriptionsCount: number;
  deliveryLogsCount: number;
}

export function TabNavigation({
  isVi,
  activeTab,
  onTabChange,
  subscriptionsCount,
  deliveryLogsCount,
}: TabNavigationProps) {
  return (
    <div className="flex border-b border-zinc-800">
      <button
        onClick={() => onTabChange('crm')}
        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
          activeTab === 'crm'
            ? 'border-cyan-500 text-cyan-400'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <ArrowRightLeft className="h-4 w-4" />
        {isVi ? 'Đầu Nối CRM (Salesforce / HubSpot)' : 'CRM Connectors'}
      </button>

      <button
        onClick={() => onTabChange('webhooks')}
        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
          activeTab === 'webhooks'
            ? 'border-cyan-500 text-cyan-400'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Webhook className="h-4 w-4" />
        {isVi ? 'Lưới Đăng Ký Webhook' : 'Webhook Subscriptions'}
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
          {subscriptionsCount}
        </span>
      </button>

      <button
        onClick={() => onTabChange('logs')}
        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
          activeTab === 'logs'
            ? 'border-cyan-500 text-cyan-400'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Clock className="h-4 w-4" />
        {isVi ? 'Nhật Ký Phân Phối Sự Kiện' : 'Delivery Audit Logs'}
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
          {deliveryLogsCount}
        </span>
      </button>

      <button
        onClick={() => onTabChange('policy')}
        className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
          activeTab === 'policy'
            ? 'border-cyan-500 text-cyan-400'
            : 'border-transparent text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <ShieldCheck className="h-4 w-4" />
        {isVi ? 'Chính Sách & Bảo Mật' : 'Policies & Security'}
      </button>
    </div>
  );
}
