'use client';

/**
 * Onboarding status widget — shown on customer dashboard.
 * Fetches /api/welcome/status and renders a 4-step horizontal timeline:
 *   1. Account created (always done if widget renders)
 *   2. First login
 *   3. First SOP installed
 *   4. First successful run
 *
 * Hidden when the user has no handover row (paid users without handover,
 * pre-handover legacy accounts).
 *
 * @module app/[locale]/dashboard/components/onboarding-status-widget
 */

import useSWR from 'swr';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

interface HandoverStatus {
  firstLoginAt: number | null;
  firstSopInstallAt: number | null;
  firstRunAt: number | null;
  status: string;
  tier: string;
  agencyName: string;
  source: string;
}

interface StatusResponse {
  handover: HandoverStatus | null;
}

const fetcher = (url: string): Promise<StatusResponse> =>
  fetch(url).then((r) => r.json() as Promise<StatusResponse>);

interface Props { isVi: boolean }

export function OnboardingStatusWidget({ isVi }: Props) {
  const { data, isLoading } = useSWR<StatusResponse>('/api/welcome/status', fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  if (isLoading || !data?.handover) return null;

  const h = data.handover;
  const steps = [
    {
      key: 'created',
      label: isVi ? 'Tạo tài khoản' : 'Account created',
      done: true,
      ts: null as number | null,
    },
    {
      key: 'login',
      label: isVi ? 'Đăng nhập lần đầu' : 'First login',
      done: !!h.firstLoginAt,
      ts: h.firstLoginAt,
    },
    {
      key: 'install',
      label: isVi ? 'Cài SOP đầu tiên' : 'First SOP installed',
      done: !!h.firstSopInstallAt,
      ts: h.firstSopInstallAt,
    },
    {
      key: 'run',
      label: isVi ? 'Chạy SOP thành công' : 'First successful run',
      done: !!h.firstRunAt,
      ts: h.firstRunAt,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            {isVi ? 'Tiến trình kích hoạt' : 'Onboarding progress'}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isVi
              ? `Gói ${h.tier} — hoàn thành ${completed}/${steps.length} bước`
              : `${h.tier} plan — ${completed} of ${steps.length} steps complete`}
          </p>
        </div>
        <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
          {pct}%
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {steps.map((s) => (
          <div
            key={s.key}
            className={`rounded-lg border p-3 ${
              s.done
                ? 'border-emerald-500/30 bg-emerald-950/20'
                : 'border-zinc-800 bg-zinc-950/40'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {s.done ? (
                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
              ) : (
                <Circle size={14} className="text-zinc-600 flex-shrink-0" />
              )}
              <span
                className={`text-xs font-medium ${s.done ? 'text-emerald-300' : 'text-zinc-500'}`}
              >
                {s.label}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-600 ml-5">
              <Clock size={10} />
              {s.ts ? formatTs(s.ts, isVi) : isVi ? 'Chưa' : 'Not yet'}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatTs(ts: number, isVi: boolean): string {
  return new Date(ts * 1000).toLocaleDateString(isVi ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}
