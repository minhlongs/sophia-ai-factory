'use client';

/**
 * Handover list — SWR-polled table of all customer handovers.
 * Shows activation milestones, status badge, resend action.
 *
 * @module app/[locale]/dashboard/admin/handover/list/handover-list-client
 */

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { CheckCircle2, Clock, RefreshCw, Send, ChevronDown, ChevronUp, Zap, User, Inbox } from 'lucide-react';
import type { CustomerHandoverRow, HandoverStatus, HandoverSource } from '@/tree/handover/handover-types';
import { HandoverStatsPanel } from './handover-stats-panel';

interface HandoverListResponse { handovers: CustomerHandoverRow[] }

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<HandoverListResponse>);

const STATUS_BADGE: Record<HandoverStatus, string> = {
  pending: 'bg-yellow-900/40 text-yellow-300 border-yellow-500/30',
  active: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30',
  at_risk: 'bg-orange-900/40 text-orange-300 border-orange-500/30',
  churned: 'bg-red-900/40 text-red-300 border-red-500/30',
};

const SOURCE_CONFIG: Record<HandoverSource, { label: { vi: string; en: string }; style: string; icon: 'zap' | 'user' }> = {
  auto_payment: { label: { vi: 'Tự động', en: 'Auto' }, style: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30', icon: 'zap' },
  auto_signup:  { label: { vi: 'Tự đăng ký', en: 'Self-signup' }, style: 'bg-blue-900/40 text-blue-300 border-blue-500/30', icon: 'zap' },
  manual:       { label: { vi: 'Thủ công', en: 'Manual' }, style: 'bg-zinc-800 text-zinc-400 border-zinc-600', icon: 'user' },
};

const STATUS_LABELS: Record<HandoverStatus, { vi: string; en: string }> = {
  pending: { vi: 'Chờ kích hoạt', en: 'Pending' },
  active: { vi: 'Đã kích hoạt', en: 'Active' },
  at_risk: { vi: 'Có nguy cơ', en: 'At Risk' },
  churned: { vi: 'Đã rời đi', en: 'Churned' },
};

function formatTs(ts: number | null, isVi: boolean): string {
  if (!ts) return isVi ? 'Chưa' : 'Not yet';
  return new Date(ts * 1000).toLocaleDateString(isVi ? 'vi-VN' : 'en-US', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

interface Props { locale: string }

export function HandoverListClient({ locale }: Props) {
  const isVi = locale.startsWith('vi');
  const { data, mutate, isLoading } = useSWR<HandoverListResponse>(
    '/api/admin/handover/list',
    fetcher,
    { refreshInterval: 30000 },
  );

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handovers = (data?.handovers ?? []).filter(
    (h) => statusFilter === 'all' || h.status === statusFilter,
  );

  async function updateStatus(id: string, status: HandoverStatus) {
    setActionLoading(`${id}-status`);
    try {
      const res = await fetch(`/api/admin/handover/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(isVi ? 'Đã cập nhật trạng thái' : 'Status updated');
        await mutate();
      } else {
        toast.error(isVi ? 'Không cập nhật được' : 'Status update failed');
      }
    } catch {
      toast.error(isVi ? 'Lỗi kết nối' : 'Connection error');
    } finally {
      setActionLoading(null);
    }
  }

  async function resendWelcome(id: string) {
    setActionLoading(`${id}-resend`);
    try {
      const res = await fetch(`/api/admin/handover/${id}/resend-welcome`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { emailSent?: boolean };
      if (res.ok && data.emailSent !== false) {
        toast.success(isVi ? 'Đã gửi lại link' : 'Welcome link resent');
      } else {
        toast.error(isVi ? 'Gửi không thành công' : 'Resend failed');
      }
      await mutate();
    } catch {
      toast.error(isVi ? 'Lỗi kết nối' : 'Connection error');
    } finally {
      setActionLoading(null);
    }
  }

  if (isLoading) {
    return (
      <div className="text-zinc-500 text-sm py-12 text-center animate-pulse">
        {isVi ? 'Đang tải...' : 'Loading...'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HandoverStatsPanel isVi={isVi} />

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'pending', 'active', 'at_risk', 'churned'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
              ${statusFilter === s
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
          >
            {s === 'all' ? (isVi ? 'Tất cả' : 'All') : (isVi ? STATUS_LABELS[s].vi : STATUS_LABELS[s].en)}
          </button>
        ))}
      </div>

      {handovers.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 py-12 px-6 text-center">
          <Inbox size={32} className="mx-auto text-zinc-600 mb-3" />
          <p className="text-zinc-300 text-sm font-medium mb-1">
            {isVi
              ? statusFilter === 'all'
                ? 'Chưa có bàn giao nào'
                : 'Không có bàn giao trong trạng thái này'
              : statusFilter === 'all'
                ? 'No handovers yet'
                : 'No handovers in this status'}
          </p>
          <p className="text-zinc-500 text-xs">
            {isVi
              ? 'Khi customer redeem FREE100 hoặc admin tạo handover, sẽ xuất hiện ở đây.'
              : 'Once customers redeem FREE100 or admin creates a handover, it will appear here.'}
          </p>
        </div>
      )}

      {handovers.map((h) => {
        const sops: string[] = h.starter_sops ? (JSON.parse(h.starter_sops) as string[]) : [];
        const expanded = expandedId === h.id;

        return (
          <div key={h.id} className="rounded-xl border border-zinc-800 bg-white/[0.03] backdrop-blur-sm p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-100">{h.agency_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${STATUS_BADGE[h.status]}`}>
                    {isVi ? STATUS_LABELS[h.status].vi : STATUS_LABELS[h.status].en}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-violet-900/40 text-violet-300 border border-violet-500/30">
                    {h.tier}
                  </span>
                  {h.source && SOURCE_CONFIG[h.source] && (
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${SOURCE_CONFIG[h.source].style}`}>
                      {SOURCE_CONFIG[h.source].icon === 'zap'
                        ? <Zap size={10} />
                        : <User size={10} />}
                      {isVi ? SOURCE_CONFIG[h.source].label.vi : SOURCE_CONFIG[h.source].label.en}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {h.agency_type?.replace('_', ' ')} ·{' '}
                  {isVi ? 'Tạo lúc' : 'Created'} {formatTs(h.created_at, isVi)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpandedId(expanded ? null : h.id)}
                  className="p-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-400 transition-colors"
                >
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button
                  onClick={() => void resendWelcome(h.id)}
                  disabled={actionLoading === `${h.id}-resend`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === `${h.id}-resend`
                    ? <RefreshCw size={12} className="animate-spin" />
                    : <Send size={12} />}
                  {isVi ? 'Gửi lại' : 'Resend'}
                </button>
              </div>
            </div>

            {/* Milestones */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: isVi ? 'Email gửi' : 'Email Sent', ts: h.welcome_email_sent_at },
                { label: isVi ? 'Đăng nhập lần đầu' : 'First Login', ts: h.customer_first_login_at },
                { label: isVi ? 'Cài SOP đầu' : 'First SOP Install', ts: h.customer_first_sop_install_at },
                { label: isVi ? 'Chạy SOP đầu' : 'First Run', ts: h.customer_first_run_at },
              ].map((m) => (
                <div key={m.label} className="rounded-lg bg-zinc-900/50 border border-zinc-800 p-2 text-center">
                  <div className="mb-1">
                    {m.ts
                      ? <CheckCircle2 size={14} className="mx-auto text-emerald-400" />
                      : <Clock size={14} className="mx-auto text-zinc-600" />}
                  </div>
                  <div className="text-xs text-zinc-400">{m.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {m.ts ? formatTs(m.ts, isVi) : '—'}
                  </div>
                </div>
              ))}
            </div>

            {/* Expanded details */}
            {expanded && (
              <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                <div className="text-xs text-zinc-500">
                  {isVi ? 'SOPs đã cài:' : 'Installed SOPs:'}{' '}
                  {sops.length > 0 ? sops.join(', ') : (isVi ? 'Không có' : 'None')}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-zinc-500">{isVi ? 'Đổi trạng thái:' : 'Change status:'}</span>
                  {(['pending', 'active', 'at_risk', 'churned'] as HandoverStatus[]).map((s) => (
                    <button
                      key={s}
                      disabled={h.status === s || !!actionLoading}
                      onClick={() => void updateStatus(h.id, s)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors disabled:opacity-40
                        ${h.status === s ? STATUS_BADGE[s] : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                    >
                      {isVi ? STATUS_LABELS[s].vi : STATUS_LABELS[s].en}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
