'use client';

/**
 * Customer Health Dashboard — Non-Technical CEO System Telemetry View.
 * Displays safe operational status across the 7 platform services and active incidents.
 *
 * @module components/system-health/customer-health-dashboard
 */

import React, { useState } from 'react';
import {
  CheckCircle2, AlertCircle, RefreshCw, Cpu, Lock, Sparkles, HardDrive, Film, CreditCard, Send,
} from 'lucide-react';
import type { CustomerSystemHealth } from '@/land/production-monitoring/customer-health-summary';
import { IncidentCard } from './incident-card';

export interface CustomerHealthDashboardProps {
  initialHealth: CustomerSystemHealth;
  locale?: 'vi' | 'en';
}

export function CustomerHealthDashboard({ initialHealth, locale = 'vi' }: CustomerHealthDashboardProps) {
  const isVi = locale === 'vi';
  const [health] = useState<CustomerSystemHealth>(initialHealth);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const services = [
    { key: 'core', name: isVi ? 'Sophia Core' : 'Sophia Core', status: health.sophiaCore, isHealthy: health.sophiaCore === 'READY', icon: Cpu },
    { key: 'auth', name: isVi ? 'Authentication' : 'Authentication', status: 'READY', isHealthy: true, icon: Lock },
    { key: 'ai', name: isVi ? 'AI Provider' : 'AI Provider', status: health.aiProvider === 'READY' ? 'READY' : 'ACTION REQUIRED', isHealthy: health.aiProvider === 'READY', icon: Sparkles },
    { key: 'storage', name: isVi ? 'Storage' : 'Storage', status: 'READY', isHealthy: true, icon: HardDrive },
    { key: 'pipeline', name: isVi ? 'Video Pipeline' : 'Video Pipeline', status: health.videoPipeline === 'READY' ? 'READY' : 'DEGRADED', isHealthy: health.videoPipeline === 'READY', icon: Film },
    { key: 'billing', name: isVi ? 'Billing' : 'Billing', status: health.billing === 'READY' ? 'READY' : 'ACTION REQUIRED', isHealthy: health.billing === 'READY', icon: CreditCard },
    { key: 'telegram', name: isVi ? 'Telegram' : 'Telegram', status: health.telegram, isHealthy: health.telegram === 'CONNECTED', icon: Send },
  ];

  return (
    <div className="space-y-8" data-testid="customer-health-dashboard">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {isVi ? 'Trung tâm Trạng thái Hệ thống' : 'Customer Health Center'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isVi ? 'Theo dõi trạng thái các dịch vụ cốt lõi và hướng dẫn xử lý khi có sự cố.' : 'Real-time overview of core platform services with actionable recommendations.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isVi ? 'Làm mới trạng thái' : 'Refresh Health'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((svc) => {
          const SvcIcon = svc.icon;
          return (
            <div key={svc.key} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm" data-testid={`status-card-${svc.key}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
                  <SvcIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{svc.name}</p>
                  <p className="font-semibold text-foreground text-sm">{svc.status}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                svc.isHealthy
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
              }`}>
                {svc.isHealthy ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                {svc.status}
              </span>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{isVi ? 'Sự cố cần lưu ý' : 'Active System Notices'}</h3>
        {health.incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-8 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20" data-testid="all-systems-operational">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <h4 className="mt-3 font-semibold text-emerald-900 text-base dark:text-emerald-200">
              {isVi ? 'Tất cả hệ thống đang hoạt động tốt' : 'All Systems Operational'}
            </h4>
            <p className="mt-1 max-w-md text-xs text-emerald-700 dark:text-emerald-300">
              {isVi ? 'Không phát hiện bất kỳ sự cố nào. Sophia đã sẵn sàng xử lý các chiến dịch video của bạn.' : 'Zero active incidents detected. Sophia is ready to process your video generation campaigns.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="incidents-list">
            {health.incidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
