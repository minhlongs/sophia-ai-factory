'use client';

/**
 * Handover stats panel — KPI grid above the admin handover list.
 * Polls /api/admin/handover/list?stats=1 every 60s.
 *
 * @module app/[locale]/dashboard/admin/handover/list/handover-stats-panel
 */

import useSWR from 'swr';
import { Users, Clock, CheckCircle2, AlertTriangle, XOctagon, MailCheck, MailX, PlayCircle } from 'lucide-react';

interface HandoverStats {
  total: number;
  pending: number;
  active: number;
  at_risk: number;
  churned: number;
  email_sent: number;
  first_login: number;
  first_run: number;
  stuck_no_login: number;
  stuck_no_run: number;
}

const fetcher = (url: string): Promise<{ stats: HandoverStats }> =>
  fetch(url).then((r) => r.json() as Promise<{ stats: HandoverStats }>);

interface Props { isVi: boolean }

export function HandoverStatsPanel({ isVi }: Props) {
  const { data, isLoading } = useSWR('/api/admin/handover/list?stats=1', fetcher, {
    refreshInterval: 60_000,
  });

  if (isLoading || !data?.stats) return null;
  const s = data.stats;

  // Conversion ratios — guard against div-by-zero
  const loginPct = s.total ? Math.round((s.first_login / s.total) * 100) : 0;
  const runPct = s.total ? Math.round((s.first_run / s.total) * 100) : 0;

  const cards: Array<{
    key: string;
    label: string;
    value: number;
    icon: React.ReactNode;
    accent: string;
    sub?: string;
  }> = [
    {
      key: 'total',
      label: isVi ? 'Tổng' : 'Total',
      value: s.total,
      icon: <Users size={16} className="text-zinc-300" />,
      accent: 'border-zinc-700',
    },
    {
      key: 'pending',
      label: isVi ? 'Chờ' : 'Pending',
      value: s.pending,
      icon: <Clock size={16} className="text-yellow-400" />,
      accent: 'border-yellow-500/30 bg-yellow-950/20',
    },
    {
      key: 'active',
      label: isVi ? 'Đã kích hoạt' : 'Active',
      value: s.active,
      icon: <CheckCircle2 size={16} className="text-emerald-400" />,
      accent: 'border-emerald-500/30 bg-emerald-950/20',
    },
    {
      key: 'at_risk',
      label: isVi ? 'Có rủi ro' : 'At risk',
      value: s.at_risk,
      icon: <AlertTriangle size={16} className="text-orange-400" />,
      accent: 'border-orange-500/30 bg-orange-950/20',
    },
    {
      key: 'churned',
      label: isVi ? 'Rời đi' : 'Churned',
      value: s.churned,
      icon: <XOctagon size={16} className="text-red-400" />,
      accent: 'border-red-500/30 bg-red-950/20',
    },
  ];

  const dropoff: Array<{ label: string; value: number; icon: React.ReactNode; sub: string }> = [
    {
      label: isVi ? 'Email đã gửi' : 'Emails sent',
      value: s.email_sent,
      icon: <MailCheck size={14} className="text-blue-400" />,
      sub: isVi ? `Login: ${loginPct}%` : `Login: ${loginPct}%`,
    },
    {
      label: isVi ? 'Đã đăng nhập' : 'Logged in',
      value: s.first_login,
      icon: <PlayCircle size={14} className="text-violet-400" />,
      sub: isVi ? `Chạy SOP: ${runPct}%` : `Run: ${runPct}%`,
    },
    {
      label: isVi ? 'Email gửi · chưa login' : 'Sent · no login',
      value: s.stuck_no_login,
      icon: <MailX size={14} className="text-orange-400" />,
      sub: isVi ? 'Cần follow-up' : 'Needs follow-up',
    },
    {
      label: isVi ? 'Login · chưa chạy' : 'Login · no run',
      value: s.stuck_no_run,
      icon: <Clock size={14} className="text-yellow-400" />,
      sub: isVi ? 'Cần kèm tay' : 'Needs hand-holding',
    },
  ];

  return (
    <div className="space-y-3 mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {cards.map((c) => (
          <div
            key={c.key}
            className={`rounded-xl border ${c.accent} p-3 flex flex-col gap-1`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">{c.label}</span>
              {c.icon}
            </div>
            <span className="text-2xl font-bold text-zinc-100 tabular-nums">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {dropoff.map((d) => (
          <div
            key={d.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">{d.label}</span>
              {d.icon}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-zinc-100 tabular-nums">{d.value}</span>
              <span className="text-[10px] text-zinc-500">{d.sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
