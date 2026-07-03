'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { Card } from '@/seed/components/ui/card';

/* ───────────────────────────────────────────────────────
 * Types
 * ─────────────────────────────────────────────────────── */

export interface KpiData {
  id: string;
  value: string;
  trend?: string;
  trendDirection?: 'up' | 'down';
  trendSub?: string;
  /** When present, renders a text label instead of trend arrow (e.g. "Stable") */
  trendLabel?: string;
}

export interface SystemService {
  id: string;
  name: string;
  status: 'healthy' | 'warning';
  latency: string;
}

export interface SignupUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  initials: string;
  avatarAlt?: string;
  tier: string;
  signupDate: string;
  status: 'active' | 'suspended';
}

export interface DeployStatus {
  sha: string;
  env: string;
  ago: string;
}

export interface AdminPageContentProps {
  /** KPI metric cards data */
  kpiMetrics?: KpiData[];
  /** System health services */
  services?: SystemService[];
  /** Recent signup rows */
  signups?: SignupUser[];
  /** Deploy status footer info */
  deployInfo?: DeployStatus;
  /** Page title */
  title?: string;
  /** Badge label next to title */
  badgeLabel?: string;
  /** Navigation tab labels for header */
  headerTabs?: Array<{ id: string; label: string; active?: boolean }>;
  /** Search placeholder */
  searchPlaceholder?: string;
}

/* ───────────────────────────────────────────────────────
 * Default data (matching HTML design)
 * ─────────────────────────────────────────────────────── */

const DEFAULT_KPI_METRICS: KpiData[] = [
  { id: 'dau', value: '1,247', trend: '5.2%', trendDirection: 'up' },
  { id: 'mrr', value: '$48,291', trend: '2.1%', trendDirection: 'up' },
  { id: 'activeUsers', value: '847', trend: '1.4%', trendDirection: 'up' },
  { id: 'serverUptime', value: '99.97%', trendLabel: 'Stable' },
  { id: 'apiLatency', value: '124ms', trend: '12ms', trendDirection: 'down' },
  { id: 'd1Queries', value: '2,341', trend: '8.5%', trendDirection: 'up' },
];

const DEFAULT_SERVICES: SystemService[] = [
  { id: 'd1', name: 'D1 Core', status: 'healthy', latency: '14ms' },
  { id: 'r2', name: 'R2 Storage', status: 'healthy', latency: '42ms' },
  { id: 'openrouter', name: 'OpenRouter', status: 'healthy', latency: '110ms' },
  { id: 'elevenlabs', name: 'ElevenLabs', status: 'healthy', latency: '89ms' },
  { id: 'heygen', name: 'HeyGen', status: 'healthy', latency: '241ms' },
  { id: 'remotion', name: 'Remotion', status: 'warning', latency: 'RETRYING' },
];

const DEFAULT_SIGNUPS: SignupUser[] = [
  {
    id: 'u1',
    name: 'Marcus Chen',
    email: 'marcus.c@example.com',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9ZmJcx2LRr1i8BEPOb-kmL59kQaUTi5RKYV9ePAnLFukztBPiQq4zyPbyWLX9LtZDNoGvd1ave9vEJOH_wgw2JHDLL2LDp9d2-xt_jK5VcHdByRvrkzZFU7lOFV4D87sLipA285ag15BBnl1sKFMkhd4ur68B480MtBsaVauRAH19UkFY2G5KZYok8YIWrFs1Z5mTJbBPcxFGtu1WV_gCe4o1K2XlTZGDqSG0KlxF7cnx2mkTw3IxrPPypRN4TztJPl6M_lyLB4k',
    initials: 'MC',
    avatarAlt: 'Close up portrait of a young entrepreneur',
    tier: 'MASTER',
    signupDate: 'Oct 28, 2023',
    status: 'active',
  },
  {
    id: 'u2',
    name: 'Sarah Jenkins',
    email: 's.jenkins@studio.io',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCLo_WSsnrKHKmGNMh2-Jtms6u9ie7Z6ZxPTG5fV2NI7qtr8hD0lDuxbOq3_2x54V8l57XKnazFMy9b8KgWtTq9vHhWSPR4LZ7P8bGlDyEWiOklkJtUQ7vPIcJO6gMSut2QJ5JC7-lC4d5GUnm7Zl9xjGMWEvYqeliFbKQ0iVSznfxIVRYkn5Cb72wG_tj3OKwMKAaY_b-8UznrkVMUYaKvIXLK6KWYDe8yVIZ0BU9JB6lsRzr8362YhdHDdcJUTmdq7dS5_OwtCNA',
    initials: 'SJ',
    avatarAlt: 'Stylish architect in a creative studio',
    tier: 'ENTERPRISE',
    signupDate: 'Oct 27, 2023',
    status: 'active',
  },
  {
    id: 'u3',
    name: 'Alex Dmitri',
    email: 'alex@dmitri.tech',
    avatar: null,
    initials: 'AD',
    tier: 'PREMIUM',
    signupDate: 'Oct 27, 2023',
    status: 'suspended',
  },
  {
    id: 'u4',
    name: 'Elena Kostic',
    email: 'elena@motion.co',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6PJ5nojf8tvkrNtNJRwaX4wjSXK1Ab1UqD7lygVOgrGUzYR6hr9as7SOQrB_9Vaqg5nVpOCub-6c9nXsFZNcZTL-REIvuA4iKtliQjsKZV5JHE_ope-qzRRbiVFWDa2AooJ20uctaZDF8atRKNROPTiJx2kQLDXcW0zvDxQMd-n4DGa15C6T1jsJMDkMVlANRnGpVGhN_T6nHQUQwFK32bM_0WYpMI7hlxbUIXYOkdmKwMLrlMIZh9v3EyWt-ZE1UQqewGTuPF5c',
    initials: 'EK',
    avatarAlt: 'Creative director in minimal dark grey room',
    tier: 'BASIC',
    signupDate: 'Oct 26, 2023',
    status: 'active',
  },
];

const DEFAULT_DEPLOY: DeployStatus = {
  sha: 'e7ec20ef7 match',
  env: 'Production',
  ago: '14m ago',
};

const DEFAULT_TABS = [
  { id: 'overview', label: 'Overview', active: true },
  { id: 'users', label: 'Users' },
  { id: 'systems', label: 'Systems' },
];

/* ───────────────────────────────────────────────────────
 * SVG chart config
 * ─────────────────────────────────────────────────────── */

const CHART_GRADIENT_ID = 'adminUserGrowthGradient';
const CHART_LABELS = ['OCT 01', 'OCT 08', 'OCT 15', 'OCT 22', 'OCT 29'];

/* ───────────────────────────────────────────────────────
 * Tier badge styles
 * ─────────────────────────────────────────────────────── */

const TIER_BADGE_STYLES: Record<string, string> = {
  MASTER: 'bg-primary/20 text-primary border border-primary/30',
  ENTERPRISE: 'bg-surface-container-highest text-on-surface border border-outline-variant',
  PREMIUM: 'bg-secondary/20 text-secondary border border-secondary/30',
  BASIC: 'bg-outline-variant/20 text-on-surface-variant border border-outline-variant',
};

/* ═══════════════════════════════════════════════════════
 * AdminPageContent
 * ═══════════════════════════════════════════════════════ */

export default function AdminPageContent({
  kpiMetrics,
  services,
  signups,
  deployInfo,
  title: customTitle,
  badgeLabel: customBadgeLabel,
  headerTabs,
  searchPlaceholder: customSearchPlaceholder,
}: AdminPageContentProps) {
  const t = useTranslations('stitch.admin');

  const metrics = kpiMetrics ?? DEFAULT_KPI_METRICS;
  const healthServices = services ?? DEFAULT_SERVICES;
  const rows = signups ?? DEFAULT_SIGNUPS;
  const deploy = deployInfo ?? DEFAULT_DEPLOY;
  const tabs = headerTabs ?? DEFAULT_TABS;
  const pageTitle = customTitle ?? t('pageTitle');
  const badge = customBadgeLabel ?? t('badge');
  const searchPlaceholder = customSearchPlaceholder ?? t('searchPlaceholder');

  return (
    <main className="flex-1 flex flex-col h-screen overflow-y-auto" aria-label={t('aria.mainContent')}>
      {/* ── Top App Bar ──────────────────────────────────── */}
      <header
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-surface/80 backdrop-blur-md border-b border-outline-variant sticky top-0 z-40 shadow-sm"
        role="banner"
      >
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-on-surface">{pageTitle}</h2>
          <div className="bg-primary/10 border border-primary/30 px-2 py-0.5 rounded text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" aria-hidden="true" />
            {badge}
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative" role="search">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full bg-surface-container-high border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant outline-none"
              aria-label={t('aria.search')}
            />
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          <nav className="hidden lg:flex items-center gap-6 mr-6" aria-label={t('aria.headerNav')}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={
                  tab.active
                    ? 'text-primary border-b-2 border-primary pb-1 text-sm font-medium'
                    : 'text-on-surface-variant pb-1 text-sm font-medium hover:text-primary transition-colors'
                }
                aria-current={tab.active ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 border-l border-outline-variant pl-4">
            <button
              className="p-2 text-on-surface-variant hover:text-primary transition-colors relative"
              aria-label={t('aria.notifications')}
            >
              <Bell className="w-5 h-5" aria-hidden="true" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" aria-hidden="true" />
            </button>
            <button
              className="bg-surface-container-highest p-1 rounded-full border border-outline-variant hover:border-primary transition-all"
              aria-label={t('aria.userMenu')}
            >
              <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-xs font-bold border border-outline-variant text-on-secondary-container">
                {t('userInitials')}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ── Dashboard Content ────────────────────────────── */}
      <div className="p-6 space-y-6">

        {/* ── KPI Row: 6 compact cards ───────────────────── */}
        <section aria-label={t('aria.kpiSection')}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {metrics.map((metric) => (
              <Card
                key={metric.id}
                className="border-outline-variant hover:border-primary/50 transition-colors p-4"
              >
                <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider mb-1">
                  {t(`kpi.${metric.id}.label`)}
                </p>
                <div className="flex items-end justify-between">
                  <h3 className="text-lg font-bold text-on-surface">{metric.value}</h3>
                  {metric.trendLabel && (
                    <span className="text-[10px] font-bold text-primary mb-0.5 uppercase tracking-tighter">
                      {metric.trendLabel}
                    </span>
                  )}
                  {metric.trend && !metric.trendLabel && (
                    <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-0.5 mb-0.5">
                      {metric.trendDirection === 'down' ? (
                        <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      {metric.trend}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Middle: User Growth Chart + System Health ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* User Growth Chart (col-span-2) */}
          <section
            aria-label={t('aria.chartSection')}
            className="lg:col-span-2 bg-surface-container border border-outline-variant rounded-2xl p-6 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-lg font-bold text-on-surface">{t('chart.title')}</h4>
              <div className="flex gap-2" role="group" aria-label={t('aria.chartPeriod')}>
                <button className="text-[10px] bg-surface-container-highest px-3 py-1 rounded-full font-bold border border-outline-variant text-on-surface">
                  {t('chart.30d')}
                </button>
                <button className="text-[10px] text-on-surface-variant px-3 py-1 rounded-full font-bold">
                  {t('chart.90d')}
                </button>
              </div>
            </div>

            <div className="h-64 relative flex items-end justify-between pt-4" role="img" aria-label={t('aria.chart')}>
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none opacity-20" aria-hidden="true">
                <div className="border-t border-on-surface-variant w-full" />
                <div className="border-t border-on-surface-variant w-full" />
                <div className="border-t border-on-surface-variant w-full" />
                <div className="border-t border-on-surface-variant w-full" />
              </div>

              {/* SVG Chart Area */}
              <div className="absolute inset-0 flex items-end pt-8 px-2" aria-hidden="true">
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 200">
                  <defs>
                    <linearGradient id={CHART_GRADIENT_ID} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#D97706" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,180 Q80,160 160,170 T320,130 T480,100 T640,60 T800,20 L800,200 L0,200 Z"
                    fill={`url(#${CHART_GRADIENT_ID})`}
                  />
                  <path
                    d="M0,180 Q80,160 160,170 T320,130 T480,100 T640,60 T800,20"
                    fill="none"
                    stroke="#D97706"
                    strokeWidth="3"
                  />
                </svg>
              </div>

              {/* Date Labels */}
              <div className="w-full flex justify-between mt-4 px-2">
                {CHART_LABELS.map((label) => (
                  <span key={label} className="text-[10px] text-on-surface-variant font-bold">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* System Health */}
          <section aria-label={t('aria.systemHealth')} className="bg-surface-container border border-outline-variant rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-bold text-on-surface">{t('systemHealth.title')}</h4>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" aria-hidden="true" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase">{t('systemHealth.status')}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-on-surface-variant">{t('systemHealth.lastPoll')}</span>
                <span className="font-bold text-on-surface">{t('systemHealth.lastPollValue')}</span>
              </div>

              <div className="space-y-3 pt-2">
                {healthServices.map((svc) => (
                  <div
                    key={svc.id}
                    className={cn(
                      'flex items-center justify-between p-2 rounded bg-surface-container-high/50 border transition-all',
                      svc.status === 'warning'
                        ? 'border-yellow-500/20'
                        : 'border-transparent hover:border-outline-variant'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {svc.status === 'healthy' ? (
                        <CheckCircle2
                          className="w-5 h-5 text-emerald-500 shrink-0"
                          style={{ fill: 'currentColor', opacity: 0.2 }}
                          aria-hidden="true"
                        />
                      ) : (
                        <AlertTriangle
                          className="w-5 h-5 text-yellow-500 shrink-0"
                          style={{ fill: 'currentColor', opacity: 0.2 }}
                          aria-hidden="true"
                        />
                      )}
                      <span className={cn(
                        'text-sm font-medium',
                        svc.status === 'warning' ? 'text-yellow-500/80' : 'text-on-surface'
                      )}>
                        {svc.name}
                      </span>
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold',
                      svc.status === 'warning' ? 'text-yellow-500/50' : 'text-on-surface-variant'
                    )}>
                      {svc.latency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ── Recent Signups Table ────────────────────────── */}
        <section aria-label={t('aria.signupsTable')} className="bg-surface-container border border-outline-variant rounded-2xl overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between border-b border-outline-variant">
            <h4 className="text-lg font-bold text-on-surface">{t('recentSignups.title')}</h4>
            <button className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
              {t('recentSignups.viewAll')}
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{t('aria.signupsTable')}</caption>
              <thead className="bg-surface-container-highest/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    {t('recentSignups.columns.user')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    {t('recentSignups.columns.tier')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    {t('recentSignups.columns.signupDate')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    {t('recentSignups.columns.status')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider text-right">
                    {t('recentSignups.columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {rows.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-surface-container-high/40 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.avatar}
                            alt={user.avatarAlt ?? user.name}
                            className="w-8 h-8 rounded-full border border-outline-variant object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-xs font-bold border border-outline-variant text-on-secondary-container shrink-0">
                            {user.initials}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-on-surface">{user.name}</p>
                          <p className="text-[11px] text-on-surface-variant">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest',
                        TIER_BADGE_STYLES[user.tier] ?? 'bg-outline-variant/20 text-on-surface-variant border border-outline-variant'
                      )}>
                        {user.tier}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-on-surface-variant">
                      {user.signupDate}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            user.status === 'active' ? 'bg-emerald-500' : 'bg-error'
                          )}
                          aria-hidden="true"
                        />
                        <span className={user.status === 'active' ? 'text-emerald-500' : 'text-error'}>
                          {user.status === 'active' ? t('recentSignups.status.active') : t('recentSignups.status.suspended')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        className="p-1 hover:text-primary transition-colors text-on-surface-variant"
                        aria-label={t('aria.userActions', { name: user.name })}
                      >
                        <MoreVertical className="w-5 h-5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-3 border-t border-outline-variant flex items-center justify-between">
            <p className="text-[11px] text-on-surface-variant">
              {t('recentSignups.showing', { from: 1, to: rows.length, total: 1247 })}
            </p>
            <div className="flex gap-2">
              <button
                className="p-1 rounded bg-surface-container-high border border-outline-variant opacity-50 cursor-not-allowed text-on-surface-variant"
                disabled
                aria-label={t('aria.previousPage')}
              >
                <ChevronLeft className="w-[18px] h-[18px]" aria-hidden="true" />
              </button>
              <button
                className="p-1 rounded bg-surface-container-high border border-outline-variant hover:border-primary transition-colors text-on-surface-variant"
                aria-label={t('aria.nextPage')}
              >
                <ChevronRight className="w-[18px] h-[18px]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* ── Deploy Status Footer ────────────────────────── */}
        <div className="flex justify-end">
          <div
            className="flex items-center gap-6 bg-surface-container-high/30 px-6 py-3 rounded-xl border border-outline-variant/30"
            aria-label={t('aria.deployStatus')}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-[18px] h-[18px] text-emerald-500 shrink-0" aria-hidden="true" />
              <span className="text-xs font-bold text-on-surface">{deploy.sha}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">
                {t('deployStatus.env')}
              </span>
              <span className="text-xs font-bold text-primary">{deploy.env}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-[18px] h-[18px] text-on-surface-variant shrink-0" aria-hidden="true" />
              <span className="text-xs text-on-surface-variant">{deploy.ago}</span>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}

/* ───────────────────────────────────────────────────────
 * Inline icon components (used above to avoid extra deps)
 * ─────────────────────────────────────────────────────── */

function SearchIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function Bell({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

AdminPageContent.displayName = 'AdminPageContent';
