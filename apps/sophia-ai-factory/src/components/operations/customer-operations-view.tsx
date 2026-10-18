'use client';

import React, { useState } from 'react';
import { FileText, LifeBuoy, Cpu } from 'lucide-react';
import { SupportTicketModal } from '@/components/support/support-ticket-modal';
import { generateSafeDiagnosticBundle } from '@/tree/diagnostics/safe-bundle-generator';
import { downloadDiagnosticBundle } from '@/components/support/diagnostic-bundle-generator';
import {
  BatchQueueMonitoringSection,
  ChannelSyndicationSection,
  type BatchJobItem,
  type BatchQueueStats,
  type ChannelSyndicationStats,
  type CustomerOperationsViewProps,
} from './customer-operations-sections';

export type {
  BatchJobItem,
  BatchQueueStats,
  ChannelSyndicationStats,
  CustomerOperationsViewProps,
};

export function CustomerOperationsView({
  locale, userId, batchQueue, syndication, openTicketsCount, appVersion, commitSha, activeProviders = [],
}: CustomerOperationsViewProps) {
  const isVi = locale === 'vi';
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  function handleDownloadDiagnostic() {
    const bundle = generateSafeDiagnosticBundle({
      userId,
      workspaceId: `ws_${userId.slice(0, 8)}`,
      appVersion,
      commitSha,
      providerStatuses: activeProviders.map((p) => ({ name: p.name, configured: p.configured, status: p.status })),
      rawErrorLogs: batchQueue.failedCount > 0 ? ['Batch render failures detected in queue'] : [],
      systemHealth: batchQueue.failedCount > 0 ? 'DEGRADED' : 'OPERATIONAL',
    });
    downloadDiagnosticBundle(bundle);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-on-surface sm:text-3xl">{isVi ? 'Trung tâm Vận hành' : 'Customer Operations Center'}</h1>
          <p className="mt-1 text-xs text-on-surface-variant sm:text-sm">{isVi ? 'Giám sát hàng đợi render, kết nối nhà cung cấp AI và hỗ trợ.' : 'Monitor batch video queue, AI providers, and support.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={handleDownloadDiagnostic} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-variant/20 px-3.5 py-2 text-xs font-bold text-on-surface hover:bg-surface-variant/40">
            <FileText className="h-3.5 w-3.5 text-primary" />{isVi ? 'Tải Báo cáo Chẩn đoán' : 'Download Diagnostic Report'}
          </button>
          <button onClick={() => setIsTicketModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-primary/90">
            <LifeBuoy className="h-3.5 w-3.5" />{isVi ? 'Hỗ trợ Kỹ thuật' : 'Support Desk'}{openTicketsCount > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">{openTicketsCount}</span>}
          </button>
        </div>
      </div>

      {/* AI Provider Readiness (BYOK) */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface p-6 shadow-xs">
        <h2 className="flex items-center gap-2 text-base font-bold text-on-surface"><Cpu className="h-4 w-4 text-primary" />{isVi ? 'Trạng thái Kết nối AI (BYOK Providers)' : 'AI Provider Readiness (BYOK)'}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {activeProviders.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-outline-variant/40 py-6 text-center text-xs text-on-surface-variant">{isVi ? 'Chưa phát hiện cấu hình khóa API. Vui lòng hoàn tất tại /setup.' : 'No active BYOK keys configured. Please visit /setup.'}</div>
          ) : (
            activeProviders.map((p) => (
              <div key={p.name} className="rounded-xl border border-outline-variant/20 bg-surface-variant/10 p-3.5">
                <div className="flex items-center justify-between"><span className="text-xs font-bold text-on-surface capitalize">{p.name}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>{p.status}</span></div>
                <div className="mt-2 text-[11px] text-on-surface-variant">{p.configured ? (isVi ? 'Đã kích hoạt' : 'Configured & Ready') : (isVi ? 'Chưa cấu hình' : 'Unconfigured')}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <BatchQueueMonitoringSection batchQueue={batchQueue} isVi={isVi} />
      <ChannelSyndicationSection syndication={syndication} isVi={isVi} />

      <SupportTicketModal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} locale={locale} />
    </div>
  );
}
