/**
 * Returning user dashboard state — shown when ≥1 SOP installed.
 * Includes: 4 stat cards, quick actions, recent runs feed, recommended SOPs.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  BookOpen,
  Plus,
  ListChecks,
  Coins,
  Video,
  Activity,
  Store,
  ArrowRight,
} from 'lucide-react';

interface SopRunRow {
  id: string;
  status: string;
  created_at: number;
  installation_id: string;
}

interface DashboardReturningUserProps {
  sopCount: number;
  mcuRemaining: number;
  videosThisMonth: number;
  recentRuns: SopRunRow[];
}

const STATUS_COLOR: Record<string, string> = {
  succeeded: 'text-green-600 dark:text-green-400',
  failed: 'text-red-600 dark:text-red-400',
  running: 'text-blue-600 dark:text-blue-400',
  queued: 'text-slate-500 dark:text-slate-400',
  partial: 'text-orange-600 dark:text-orange-400',
};

export async function DashboardReturningUser({
  sopCount,
  mcuRemaining,
  videosThisMonth,
  recentRuns,
}: DashboardReturningUserProps) {
  const t = await getTranslations('dashboard.home');

  const stats = [
    { icon: BookOpen, label: t('stat_active_sops'), value: sopCount, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { icon: Coins, label: t('stat_mcu_remaining'), value: mcuRemaining.toLocaleString(), color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { icon: Video, label: t('stat_videos'), value: videosThisMonth, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { icon: Activity, label: t('stat_runs'), value: recentRuns.length, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  ];

  const quickActions = [
    { icon: Store, label: t('qa_browse'), href: '/dashboard/sop-marketplace' },
    { icon: Plus, label: t('qa_install'), href: '/dashboard/sop-marketplace' },
    { icon: ListChecks, label: t('qa_runs'), href: '/dashboard/missions' },
    { icon: Coins, label: t('qa_credits'), href: '/dashboard/credits' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{stat.label}</p>
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.bg}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('quick_actions')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="cursor-pointer flex flex-col items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/40 p-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors duration-150 text-center"
              >
                <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent runs */}
      <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-lg rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('recent_runs')}</h2>
          <Link href="/dashboard/missions" className="cursor-pointer text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-150 flex items-center gap-1">
            {t('view_all_runs')} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {recentRuns.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">{t('no_runs')}</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {recentRuns.slice(0, 10).map((run) => (
              <div key={run.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Run <span className="font-mono">{run.id.slice(0, 8)}</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    {new Date(run.created_at * 1000).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs font-medium capitalize ${STATUS_COLOR[run.status] ?? 'text-slate-500'}`}>
                  {run.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
