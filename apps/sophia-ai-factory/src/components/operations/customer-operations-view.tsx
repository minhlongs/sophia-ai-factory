'use client';

import React, { useState } from 'react';
import { PlayCircle, Clock, CheckCircle2, AlertCircle, Share2, Youtube, Send, FileText, LifeBuoy } from 'lucide-react';
import { SupportTicketModal } from '@/components/support/support-ticket-modal';
import { generateDiagnosticBundle, downloadDiagnosticBundle, type ActiveProviderStatus } from '@/components/support/diagnostic-bundle-generator';

export interface BatchJobItem {
  id: string;
  title: string;
  status: 'running' | 'scheduled' | 'completed' | 'failed';
  createdAt: string;
}

export interface BatchQueueStats {
  runningCount: number;
  scheduledCount: number;
  completedCount: number;
  failedCount: number;
  recentJobs: BatchJobItem[];
}

export interface ChannelSyndicationStats {
  youtube: { status: 'connected' | 'idle' | 'uploading' | 'error' | 'not_configured'; channelTitle?: string; activeVideosCount: number };
  tiktok: { status: 'connected' | 'idle' | 'syncing' | 'error' | 'not_configured'; accountName?: string; activeVideosCount: number };
  telegram: { status: 'connected' | 'not_connected'; alertsEnabled: boolean; pairedAt?: string };
}

export interface CustomerOperationsViewProps {
  locale: 'vi' | 'en';
  userId: string;
  batchQueue: BatchQueueStats;
  syndication: ChannelSyndicationStats;
  openTicketsCount: number;
  appVersion?: string;
  commitSha?: string;
  activeProviders?: ActiveProviderStatus[];
}

export function CustomerOperationsView({
  locale, userId, batchQueue, syndication, openTicketsCount, appVersion, commitSha, activeProviders = [],
}: CustomerOperationsViewProps) {
  const isVi = locale === 'vi';
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  function handleDownloadDiagnostic() {
    const bundle = generateDiagnosticBundle({
      userId, appVersion, commitSha, providers: activeProviders,
      recentErrors: batchQueue.failedCount > 0 ? ['Batch render failures detected in queue'] : [],
      systemHealth: batchQueue.failedCount > 0 ? 'ACTION_REQUIRED' : 'READY',
    });
    downloadDiagnosticBundle(bundle);
  }

  const statusBadge = (st: BatchJobItem['status']) => {
    switch (st) {
      case 'running': return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />{isVi ? 'Đang render' : 'Running'}</span>;
      case 'scheduled': return <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-500"><Clock className="h-3 w-3" />{isVi ? 'Đã lên lịch' : 'Scheduled'}</span>;
      case 'completed': return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500"><CheckCircle2 className="h-3 w-3" />{isVi ? 'Hoàn thành' : 'Done'}</span>;
      default: return <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-500"><AlertCircle className="h-3 w-3" />{isVi ? 'Lỗi' : 'Failed'}</span>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-on-surface sm:text-3xl">{isVi ? 'Trung tâm Vận hành' : 'Customer Operations Center'}</h1>
          <p className="mt-1 text-xs text-on-surface-variant sm:text-sm">{isVi ? 'Giám sát hàng đợi render, trạng thái đăng kênh và trung tâm hỗ trợ.' : 'Monitor batch video queue, channel syndication, and customer support.'}</p>
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

      {/* Batch Queue Monitoring */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface p-6 shadow-xs">
        <h2 className="flex items-center gap-2 text-base font-bold text-on-surface"><PlayCircle className="h-4 w-4 text-primary" />{isVi ? 'Hàng đợi Render Video (Batch Queue)' : 'Batch Queue Monitoring'}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-amber-500/10 p-3.5"><div className="text-xs text-amber-600 font-semibold">{isVi ? 'Đang chạy' : 'Running'}</div><div className="mt-1 text-2xl font-black text-amber-600">{batchQueue.runningCount}</div></div>
          <div className="rounded-xl bg-blue-500/10 p-3.5"><div className="text-xs text-blue-600 font-semibold">{isVi ? 'Đã lên lịch' : 'Scheduled'}</div><div className="mt-1 text-2xl font-black text-blue-600">{batchQueue.scheduledCount}</div></div>
          <div className="rounded-xl bg-emerald-500/10 p-3.5"><div className="text-xs text-emerald-600 font-semibold">{isVi ? 'Đã render xong' : 'Completed'}</div><div className="mt-1 text-2xl font-black text-emerald-600">{batchQueue.completedCount}</div></div>
          <div className="rounded-xl bg-surface-variant/20 p-3.5"><div className="text-xs text-on-surface-variant font-semibold">{isVi ? 'Lỗi cần kiểm tra' : 'Failed'}</div><div className="mt-1 text-2xl font-black text-on-surface">{batchQueue.failedCount}</div></div>
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{isVi ? 'Tác vụ gần đây' : 'Recent Pipeline Jobs'}</h3>
          {batchQueue.recentJobs.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-outline-variant/40 py-8 text-center text-xs text-on-surface-variant">{isVi ? 'Chưa có tác vụ video nào trong hàng đợi.' : 'No active or scheduled render jobs in queue.'}</div>
          ) : (
            <div className="mt-3 divide-y divide-outline-variant/20 overflow-hidden rounded-xl border border-outline-variant/30">
              {batchQueue.recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 text-xs bg-surface-variant/5">
                  <div className="min-w-0 pr-2"><div className="font-semibold text-on-surface truncate">{job.title}</div><div className="text-[11px] text-on-surface-variant">{job.id}</div></div>
                  <div className="flex items-center gap-3 shrink-0">{statusBadge(job.status)}<span className="text-[11px] text-on-surface-variant hidden sm:inline">{new Date(job.createdAt).toLocaleTimeString(isVi ? 'vi-VN' : 'en-US')}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Channel Syndication Status */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface p-6 shadow-xs">
        <h2 className="flex items-center gap-2 text-base font-bold text-on-surface"><Share2 className="h-4 w-4 text-primary" />{isVi ? 'Đồng bộ Kênh Truyền thông (Channel Syndication)' : 'Channel Syndication Status'}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-outline-variant/20 bg-surface-variant/10 p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Youtube className="h-5 w-5 text-red-500" /><span className="font-bold text-on-surface">YouTube</span></div><span className="rounded-full bg-surface-variant/40 px-2 py-0.5 text-[10px] font-bold uppercase">{syndication.youtube.status}</span></div>
            <div className="mt-3 text-xs text-on-surface-variant">{syndication.youtube.channelTitle || (isVi ? 'Chưa liên kết kênh' : 'No channel configured')}</div>
            <div className="mt-2 text-xs font-semibold text-on-surface">{isVi ? `${syndication.youtube.activeVideosCount} video đang đồng bộ` : `${syndication.youtube.activeVideosCount} active videos`}</div>
          </div>
          <div className="rounded-xl border border-outline-variant/20 bg-surface-variant/10 p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Share2 className="h-5 w-5 text-cyan-500" /><span className="font-bold text-on-surface">TikTok</span></div><span className="rounded-full bg-surface-variant/40 px-2 py-0.5 text-[10px] font-bold uppercase">{syndication.tiktok.status}</span></div>
            <div className="mt-3 text-xs text-on-surface-variant">{syndication.tiktok.accountName || (isVi ? 'Chưa cấu hình tài khoản' : 'No account configured')}</div>
            <div className="mt-2 text-xs font-semibold text-on-surface">{isVi ? `${syndication.tiktok.activeVideosCount} video đang phân phối` : `${syndication.tiktok.activeVideosCount} published videos`}</div>
          </div>
          <div className="rounded-xl border border-outline-variant/20 bg-surface-variant/10 p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Send className="h-5 w-5 text-sky-500" /><span className="font-bold text-on-surface">Telegram Bot</span></div><span className="rounded-full bg-surface-variant/40 px-2 py-0.5 text-[10px] font-bold uppercase">{syndication.telegram.status}</span></div>
            <div className="mt-3 text-xs text-on-surface-variant">@Sophia_Bbot</div>
            <div className="mt-2 text-xs font-semibold text-on-surface">{syndication.telegram.alertsEnabled ? (isVi ? 'Thông báo sự cố đang bật' : 'Alert notifications ON') : (isVi ? 'Chưa kích hoạt cảnh báo' : 'Alerts disabled')}</div>
          </div>
        </div>
      </div>

      <SupportTicketModal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} locale={locale} />
    </div>
  );
}
