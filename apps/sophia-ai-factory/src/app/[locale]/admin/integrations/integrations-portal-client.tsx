'use client';

/**
 * Enterprise Integrations Portal Client
 *
 * Interactive bilingual management console for:
 * - Salesforce, HubSpot, Zapier & Custom CRM connectors.
 * - Real-time CRM synchronization triggers and event timeline.
 * - Webhook subscriptions, Web Crypto HMAC-SHA256 test pings, and delivery logs.
 * - Sophia Authority Bias and LWW conflict resolution policies.
 *
 * Layer: land (Admin UI Client Component)
 *
 * @module app/[locale]/admin/integrations/integrations-portal-client
 */

import React, { useState, useTransition } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Webhook,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
  Server,
  Zap,
  ExternalLink,
  Key,
  ArrowRightLeft,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type {
  EnterpriseCrmConfig,
  CrmSyncEvent,
  WebhookSubscription,
  WebhookDeliveryLog,
  CrmProvider,
} from '@/tree/integrations/types';
import {
  configureCrm,
  triggerCrmSync,
  subscribeWebhook,
  testWebhookEndpointAction,
} from '@/land/integrations/integration-actions';

interface IntegrationsPortalClientProps {
  initialConfigs: EnterpriseCrmConfig[];
  initialSyncEvents: CrmSyncEvent[];
  initialSubscriptions: WebhookSubscription[];
  initialDeliveryLogs: WebhookDeliveryLog[];
  tenantId: string;
  locale: 'en' | 'vi';
}

export function IntegrationsPortalClient({
  initialConfigs,
  initialSyncEvents,
  initialSubscriptions,
  initialDeliveryLogs,
  tenantId,
  locale,
}: IntegrationsPortalClientProps) {
  const isVi = locale === 'vi';
  const [activeTab, setActiveTab] = useState<'crm' | 'webhooks' | 'logs' | 'policy'>('crm');

  const [configs, setConfigs] = useState<EnterpriseCrmConfig[]>(initialConfigs);
  const [syncEvents, setSyncEvents] = useState<CrmSyncEvent[]>(initialSyncEvents);
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>(initialSubscriptions);
  const [deliveryLogs] = useState<WebhookDeliveryLog[]>(initialDeliveryLogs);

  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
  const [testResult, setTestResult] = useState<Record<string, { status: string; http?: number }>>({});

  const handleTestPing = (subId: string, url: string, secret: string) => {
    startTransition(async () => {
      setTestResult((prev) => ({ ...prev, [subId]: { status: 'testing' } }));
      const res = await testWebhookEndpointAction(url, secret);
      if (res.success) {
        setTestResult((prev) => ({
          ...prev,
          [subId]: { status: 'success', http: res.data?.httpStatus || 200 },
        }));
        setStatusMessage({
          type: 'success',
          text: isVi
            ? `Ping thành công tới ${url} (HTTP ${res.data?.httpStatus || 200})`
            : `Ping succeeded to ${url} (HTTP ${res.data?.httpStatus || 200})`,
        });
      } else {
        setTestResult((prev) => ({
          ...prev,
          [subId]: { status: 'error', http: 500 },
        }));
        setStatusMessage({
          type: 'error',
          text: isVi
            ? `Thất bại khi gửi ping tới ${url}: ${res.error}`
            : `Failed ping to ${url}: ${res.error}`,
        });
      }
    });
  };

  const handleSaveCrmConfig = () => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await configureCrm({
        tenantId,
        provider: selectedProvider,
        apiEndpoint: crmEndpoint || null,
        clientId: crmClientId || null,
        syncDirection,
        isActive: true,
      });

      if (res.success && res.data) {
        const saved = res.data;
        setConfigs((prev) => {
          const index = prev.findIndex((c) => c.provider === saved.provider);
          if (index >= 0) {
            const next = [...prev];
            next[index] = saved;
            return next;
          }
          return [...prev, saved];
        });
        setStatusMessage({
          type: 'success',
          text: isVi
            ? `Đã lưu cấu hình kết nối ${selectedProvider.toUpperCase()}`
            : `Successfully configured ${selectedProvider.toUpperCase()} connector`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to save CRM config',
        });
      }
    });
  };

  const handleTriggerSync = (provider: CrmProvider) => {
    startTransition(async () => {
      setStatusMessage(null);
      const res = await triggerCrmSync(tenantId, provider, 'deal', 'test_deal_sample');
      if (res.success && res.data) {
        setSyncEvents((prev) => [res.data!, ...prev]);
        setStatusMessage({
          type: 'success',
          text: isVi
            ? `Đã kích hoạt đồng bộ ${provider.toUpperCase()}`
            : `Successfully triggered ${provider.toUpperCase()} sync event`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to trigger sync',
        });
      }
    });
  };

  const handleCreateSubscription = () => {
    if (!newSubUrl.startsWith('http')) {
      setStatusMessage({
        type: 'error',
        text: isVi ? 'URL Webhook không hợp lệ' : 'Invalid webhook URL',
      });
      return;
    }

    startTransition(async () => {
      setStatusMessage(null);
      const generatedSecret = newSubSecret || `whsec_${Math.random().toString(36).slice(2, 10)}${Date.now()}`;
      const res = await subscribeWebhook(
        tenantId,
        newSubUrl,
        generatedSecret,
        selectedEvents,
        newSubDesc
      );

      if (res.success && res.data) {
        setSubscriptions((prev) => [res.data!, ...prev]);
        setNewSubUrl('');
        setNewSubSecret('');
        setNewSubDesc('');
        setStatusMessage({
          type: 'success',
          text: isVi
            ? 'Đã tạo đăng ký Webhook mới thành công'
            : 'Successfully registered new webhook subscription',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to subscribe webhook',
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              {isVi ? 'Tích Hợp CRM Doanh Nghiệp & Lưới Webhook' : 'Enterprise CRM & Webhook Bus'}
            </h1>
            <span className="rounded-full bg-cyan-950 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-800">
              Pillar R2
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {isVi
              ? 'Đồng bộ hai chiều Salesforce & HubSpot, chữ ký mã hóa Web Crypto HMAC-SHA256, và bảo vệ hợp đồng Sophia Authority Bias.'
              : 'Bi-directional Salesforce & HubSpot sync, Web Crypto HMAC-SHA256 signing, and Sophia Authority Bias protection.'}
          </p>
        </div>

        {/* Global Authority Status Pill */}
        <div className="flex items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>
            {isVi ? 'Quyền Uy Hợp Đồng: KÍCH HOẠT (LWW Bias)' : 'Contract Authority: ACTIVE (LWW Bias)'}
          </span>
        </div>
      </div>

      {/* Status Notifications */}
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

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('crm')}
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
          onClick={() => setActiveTab('webhooks')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'webhooks'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Webhook className="h-4 w-4" />
          {isVi ? 'Lưới Đăng Ký Webhook' : 'Webhook Subscriptions'}
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
            {subscriptions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Clock className="h-4 w-4" />
          {isVi ? 'Nhật Ký Phân Phối Sự Kiện' : 'Delivery Audit Logs'}
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
            {deliveryLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('policy')}
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

      {/* Tab 1: CRM Connectors */}
      {activeTab === 'crm' && (
        <div className="space-y-6">
          {/* Connector Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {(['salesforce', 'hubspot', 'zapier'] as CrmProvider[]).map((prov) => {
              const cfg = configs.find((c) => c.provider === prov);
              const isConfigured = Boolean(cfg?.isActive);

              return (
                <div
                  key={prov}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm transition-all hover:border-zinc-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-lg bg-zinc-800 p-2 text-cyan-400">
                        {prov === 'salesforce' ? (
                          <Server className="h-5 w-5 text-blue-400" />
                        ) : prov === 'hubspot' ? (
                          <Zap className="h-5 w-5 text-orange-400" />
                        ) : (
                          <ArrowRightLeft className="h-5 w-5 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white capitalize">{prov}</h3>
                        <p className="text-xs text-zinc-400">
                          {prov === 'salesforce'
                            ? 'Opportunity & Account Sync'
                            : prov === 'hubspot'
                            ? 'Deal & Pipeline Sync'
                            : 'Webhook Automations'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                        isConfigured
                          ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-500'
                      }`}
                    >
                      {isConfigured ? (isVi ? 'Đang Hoạt Động' : 'Active') : (isVi ? 'Chưa Kết Nối' : 'Inactive')}
                    </span>
                  </div>

                  <div className="mt-4 border-t border-zinc-800/80 pt-3 text-xs text-zinc-400 space-y-1.5">
                    <div className="flex justify-between">
                      <span>{isVi ? 'Hướng Đồng Bộ' : 'Sync Direction'}:</span>
                      <span className="font-mono text-zinc-200">
                        {cfg?.syncDirection || 'bidirectional'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isVi ? 'Endpoint API' : 'API Endpoint'}:</span>
                      <span className="truncate max-w-[160px] font-mono text-zinc-300">
                        {cfg?.apiEndpoint || (isVi ? 'Chưa thiết lập' : 'Not set')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleTriggerSync(prov)}
                      disabled={isPending}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`h-3 w-3 ${isPending ? 'animate-spin' : ''}`} />
                      {isVi ? 'Đồng Bộ Thử' : 'Trigger Sync'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CRM Configuration Drawer/Form */}
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
                onClick={handleSaveCrmConfig}
                disabled={isPending}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition disabled:opacity-50"
              >
                {isVi ? 'Lưu Cấu Hình' : 'Save Configuration'}
              </button>
            </div>
          </div>

          {/* Sync Events Table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
            <h3 className="text-base font-semibold text-white">
              {isVi ? 'Lịch Sử Sự Kiện Đồng Bộ CRM' : 'Recent CRM Sync Events'}
            </h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="pb-2.5 font-medium">{isVi ? 'Mã Sự Kiện' : 'Event ID'}</th>
                    <th className="pb-2.5 font-medium">{isVi ? 'Thực Thể' : 'Entity'}</th>
                    <th className="pb-2.5 font-medium">{isVi ? 'Hướng' : 'Direction'}</th>
                    <th className="pb-2.5 font-medium">{isVi ? 'Trạng Thái' : 'Status'}</th>
                    <th className="pb-2.5 font-medium">{isVi ? 'Thời Gian' : 'Timestamp'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {syncEvents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-zinc-500">
                        {isVi ? 'Chưa có sự kiện đồng bộ nào' : 'No sync events recorded yet'}
                      </td>
                    </tr>
                  ) : (
                    syncEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-zinc-800/30">
                        <td className="py-2.5 font-mono text-zinc-400 truncate max-w-[120px]">
                          {evt.id}
                        </td>
                        <td className="py-2.5">
                          <span className="capitalize">{evt.entityType}</span>:{' '}
                          <span className="font-mono text-zinc-400">{evt.entityId}</span>
                        </td>
                        <td className="py-2.5 uppercase font-mono text-xs">{evt.direction}</td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                              evt.status === 'synced'
                                ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
                                : evt.status === 'ignored'
                                ? 'border-purple-800 bg-purple-950/60 text-purple-400'
                                : evt.status === 'pending'
                                ? 'border-amber-800 bg-amber-950/60 text-amber-400'
                                : 'border-red-800 bg-red-950/60 text-red-400'
                            }`}
                          >
                            {evt.status === 'ignored' ? (
                              isVi ? 'Đã Chặn (Bảo Vệ Quyền Uy)' : 'Ignored (Authority Guard)'
                            ) : (
                              evt.status
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 text-zinc-400">
                          {new Date(evt.createdAt).toLocaleString(isVi ? 'vi-VN' : 'en-US')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Webhook Subscriptions */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          {/* Add Subscription Form */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
            <h3 className="text-base font-semibold text-white">
              {isVi ? 'Đăng Ký Webhook Đầu Ra Mới' : 'Register New Outbound Webhook Subscription'}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              {isVi
                ? 'Tự động gửi thông báo với chữ ký bảo mật Web Crypto HMAC-SHA256 khi có sự kiện.'
                : 'Publishes signed payloads with HMAC-SHA256 and 5-tier exponential backoff.'}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-300">
                  {isVi ? 'URL Điểm Cuối (Endpoint URL)' : 'Endpoint URL'}
                </label>
                <input
                  type="url"
                  placeholder="https://client-api.com/webhooks/sophia"
                  value={newSubUrl}
                  onChange={(e) => setNewSubUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300">
                  {isVi ? 'Khóa Bí Mật Ký Số (Tự sinh nếu để trống)' : 'HMAC Signing Secret (Auto-generated if blank)'}
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    placeholder="whsec_..."
                    value={newSubSecret}
                    onChange={(e) => setNewSubSecret(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                  <Key className="absolute right-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300">
                  {isVi ? 'Mô Tả Kết Nối' : 'Description / System'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. ERP Invoicing Bus"
                  value={newSubDesc}
                  onChange={(e) => setNewSubDesc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-2">
                  {isVi ? 'Loại Sự Kiện Đăng Ký' : 'Subscribed Events'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {['deal.won', 'deal.updated', 'contract.signed', 'invoice.paid', 'video.rendered'].map((ev) => {
                    const isSelected = selectedEvents.includes(ev);
                    return (
                      <button
                        key={ev}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedEvents(selectedEvents.filter((e) => e !== ev));
                          } else {
                            setSelectedEvents([...selectedEvents, ev]);
                          }
                        }}
                        className={`rounded-lg px-3 py-1 text-xs font-mono transition border ${
                          isSelected
                            ? 'bg-cyan-950/80 border-cyan-700 text-cyan-300 font-semibold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {ev}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleCreateSubscription}
                disabled={isPending}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition disabled:opacity-50"
              >
                {isVi ? 'Tạo Đăng Ký' : 'Create Subscription'}
              </button>
            </div>
          </div>

          {/* Subscriptions List */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
            <h3 className="text-base font-semibold text-white">
              {isVi ? 'Danh Sách Điểm Cuối Đang Đăng Ký' : 'Active Webhook Endpoints'}
            </h3>
            <div className="mt-4 space-y-3">
              {subscriptions.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  {isVi ? 'Chưa có webhook nào được đăng ký' : 'No webhooks subscribed yet'}
                </p>
              ) : (
                subscriptions.map((sub) => {
                  const test = testResult[sub.id];

                  return (
                    <div
                      key={sub.id}
                      className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition-all hover:border-zinc-700"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-zinc-200">
                              {sub.endpointUrl}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                                sub.isActive
                                  ? 'border-emerald-800 bg-emerald-950/50 text-emerald-400'
                                  : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                              }`}
                            >
                              {sub.isActive ? (isVi ? 'Hoạt động' : 'Active') : (isVi ? 'Tạm dừng' : 'Disabled')}
                            </span>
                          </div>
                          {sub.description && (
                            <p className="text-xs text-zinc-400 mt-0.5">{sub.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {test && (
                            <span
                              className={`text-xs px-2 py-1 rounded font-mono ${
                                test.status === 'success'
                                  ? 'bg-emerald-950 text-emerald-400'
                                  : test.status === 'error'
                                  ? 'bg-red-950 text-red-400'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}
                            >
                              {test.status === 'testing'
                                ? 'Testing...'
                                : test.status === 'success'
                                ? `HTTP ${test.http}`
                                : 'Failed'}
                            </span>
                          )}

                          <button
                            onClick={() => handleTestPing(sub.id, sub.endpointUrl, sub.secretKey)}
                            disabled={isPending}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <Send className="h-3 w-3 text-cyan-400" />
                            {isVi ? 'Gửi Ping Thử' : 'Test Ping'}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-2.5 text-xs text-zinc-400">
                        <span className="text-zinc-500">{isVi ? 'Sự Kiện' : 'Events'}:</span>
                        {sub.eventTypes.map((et) => (
                          <span
                            key={et}
                            className="rounded bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] text-zinc-300"
                          >
                            {et}
                          </span>
                        ))}
                        <span className="ml-auto text-[11px] text-zinc-500 font-mono">
                          Secret: {sub.secretKey.slice(0, 10)}...
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Delivery Audit Logs */}
      {activeTab === 'logs' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">
              {isVi ? 'Nhật Ký Phân Phối Sự Kiện HMAC-SHA256' : 'Cryptographic Webhook Delivery Logs'}
            </h3>
            <span className="text-xs text-zinc-400">
              {isVi ? 'Tự động kiểm tra Replay Attack (300s)' : 'Enforces 300s Replay Window'}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="pb-2.5 font-medium">{isVi ? 'Mã Lần Gửi' : 'Delivery ID'}</th>
                  <th className="pb-2.5 font-medium">{isVi ? 'Sự Kiện' : 'Event'}</th>
                  <th className="pb-2.5 font-medium">{isVi ? 'Mã HTTP' : 'HTTP Code'}</th>
                  <th className="pb-2.5 font-medium">{isVi ? 'Trạng Thái' : 'Status'}</th>
                  <th className="pb-2.5 font-medium">{isVi ? 'Thời Gian (ms)' : 'Latency'}</th>
                  <th className="pb-2.5 font-medium">{isVi ? 'Chữ Ký (v1)' : 'Signature (v1)'}</th>
                  <th className="pb-2.5 font-medium">{isVi ? 'Lần Thử' : 'Attempt'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {deliveryLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-500">
                      {isVi ? 'Chưa có nhật ký gửi sự kiện nào' : 'No delivery logs recorded yet'}
                    </td>
                  </tr>
                ) : (
                  deliveryLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-800/30">
                      <td className="py-2.5 font-mono text-zinc-400">{log.id}</td>
                      <td className="py-2.5 font-mono text-cyan-300">{log.eventType}</td>
                      <td className="py-2.5 font-mono">
                        {log.httpStatus ? (
                          <span
                            className={
                              log.httpStatus >= 200 && log.httpStatus < 300
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }
                          >
                            {log.httpStatus}
                          </span>
                        ) : (
                          <span className="text-zinc-500">-</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                            log.status === 'success'
                              ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
                              : log.status === 'retrying'
                              ? 'border-amber-800 bg-amber-950/60 text-amber-400'
                              : 'border-red-800 bg-red-950/60 text-red-400'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-zinc-400">{log.durationMs || 0}ms</td>
                      <td className="py-2.5 font-mono text-[11px] text-zinc-500 truncate max-w-[140px]">
                        {log.signature}
                      </td>
                      <td className="py-2.5 font-mono text-zinc-300">#{log.attemptNumber} / 5</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Policies & Security */}
      {activeTab === 'policy' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Conflict Policy */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">
                {isVi ? 'Quy Tắc Quyền Uy Hợp Đồng (Sophia Authority Bias)' : 'Sophia Contract Authority Bias'}
              </h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {isVi
                ? 'Khi hợp đồng doanh nghiệp đã ký số (deal_stage = closed_won), hệ thống Sophia AI Factory là nguồn sự thật tài chính duy nhất. Mọi cố gắng hạ bậc (downgrade) trạng thái từ CRM bên ngoài (Salesforce/HubSpot) đều bị từ chối tự động và đánh dấu trạng thái "ignored".'
                : 'When an enterprise deal has a cryptographically signed contract (closed_won), Sophia AI Factory is the ultimate financial authority. Any attempt by external CRMs to downgrade or revert the stage is automatically rejected and logged as "ignored".'}
            </p>
            <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-xs font-mono text-zinc-400 space-y-1">
              <div className="text-emerald-400">✓ closed_won + contract_sha256 = LOCKED</div>
              <div className="text-zinc-500">→ Incoming external downgrade = REJECTED (ignored)</div>
              <div className="text-zinc-500">→ Incoming SDR contact updates = APPLIED (non-destructive)</div>
            </div>
          </div>

          {/* Web Crypto Signature Policy */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <Lock className="h-5 w-5 text-cyan-400" />
              <h3 className="text-base font-semibold text-white">
                {isVi ? 'Bảo Vệ Chữ Ký Mã Hóa & Chống Replay' : 'Web Crypto HMAC & Replay Protection'}
              </h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {isVi
                ? 'Mọi webhook phát đi đều mang tiêu đề X-Sophia-Signature-256 được tính toán qua crypto.subtle HMAC-SHA256 theo định dạng t=<timestamp>,v1=<hex>. Cửa sổ kiểm tra chống tấn công phát lại (Replay Attack) được áp dụng nghiêm ngặt ở mức 300 giây (5 phút).'
                : 'Every outbound webhook carries the X-Sophia-Signature-256 header computed via crypto.subtle HMAC-SHA256 in format t=<timestamp>,v1=<hex>. Anti-replay attack tolerance is enforced at 300 seconds (5 minutes).'}
            </p>
            <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-xs font-mono text-zinc-400 space-y-1">
              <div className="text-cyan-400">X-Sophia-Signature-256: t=...,v1=&lt;hex&gt;</div>
              <div className="text-zinc-500">Tolerance: |t_now - t_sig| &le; 300s</div>
              <div className="text-zinc-500">Backoff: 0s, 30s, 120s, 600s, 3600s with &plusmn;10% jitter</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
