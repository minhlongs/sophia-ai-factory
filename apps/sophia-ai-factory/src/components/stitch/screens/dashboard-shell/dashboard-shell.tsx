'use client';

import React from 'react';
import {
  LayoutDashboard,
  Send,
  Play,
  BarChart3,
  CreditCard,
  Link2,
  Settings,
  Users,
  History,
  Activity,
  Search,
  Bell,
  LogOut,
  Zap,
  Eye,
  Heart,
  GitCompare,
  Timer,
  Plus,
  ChevronRight,
  Monitor,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';

/* ───────────────────────────────────────────────────────────────
 * Types
 * ─────────────────────────────────────────────────────────────── */

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  active?: boolean;
}

interface ProjectCard {
  id: string;
  title: string;
  thumbnailAlt: string;
  thumbnailUrl: string;
  duration: string;
  modifiedLabel: string;
}

interface DashboardShellProps {
  /** Sidebar loading state */
  loading?: boolean;
  /** Current user name */
  userName?: string;
  /** Current user email */
  userEmail?: string;
  /** Current user avatar URL (optional) */
  userAvatar?: string | null;
  /** Active nav item id (derived from pathname in production) */
  activeNav?: string;
  /** Recent project cards */
  projects?: ProjectCard[];
  /** GPU credit usage */
  gpuUsed?: number;
  /** GPU credit total */
  gpuTotal?: number;
  /** Welcome heading user name override */
  welcomeName?: string;
  /** Number of processing campaigns */
  activeCampaigns?: number;
  /** Total impressions value */
  totalImpressions?: string;
  /** Engagement rate */
  engagementRate?: string;
  /** Average conversion rate */
  avgConversion?: string;
  /** Active renders count */
  activeRenders?: number;
  /** Children rendered inside content area (wraps the default content if provided) */
  children?: React.ReactNode;
}

/* ───────────────────────────────────────────────────────────────
 * Navigation configuration
 * ─────────────────────────────────────────────────────────────── */

const MAIN_NAV: NavItem[] = [
  { label: 'dashboard', icon: LayoutDashboard, href: '/dashboard', active: true },
  { label: 'campaigns', icon: Send, href: '/campaigns' },
  { label: 'videos', icon: Play, href: '/videos' },
  { label: 'analytics', icon: BarChart3, href: '/analytics' },
];

const MANAGEMENT_NAV: NavItem[] = [
  { label: 'billing', icon: CreditCard, href: '/billing' },
  { label: 'affiliates', icon: Link2, href: '/affiliates' },
  { label: 'settings', icon: Settings, href: '/settings' },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'users', icon: Users, href: '/admin/users' },
  { label: 'licenses', icon: Monitor, href: '/admin/licenses' },
  { label: 'auditLog', icon: History, href: '/admin/audit-log' },
  { label: 'systemHealth', icon: Activity, href: '/admin/system-health' },
];

/* ───────────────────────────────────────────────────────────────
 * NavLink — single sidebar item
 * ─────────────────────────────────────────────────────────────── */

function NavLink({ item }: { item: NavItem }) {
  const t = useTranslations('stitch.dashboardShell');
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      aria-label={t(`sidebar.${item.label}`)}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all rounded-lg',
        item.active
          ? 'bg-[#6366F1]/10 text-[#c3c3ee] border-l-[3px] border-[#6366F1]'
          : 'text-[#acaab5] hover:text-[#e7e4f0] hover:bg-[#25252e]'
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span>{t(`sidebar.${item.label}`)}</span>
    </a>
  );
}

/* ───────────────────────────────────────────────────────────────
 * Sidebar — left navigation panel
 * ─────────────────────────────────────────────────────────────── */

function Sidebar({
  userName,
  userEmail,
}: {
  userName?: string;
  userEmail?: string;
}) {
  const t = useTranslations('stitch.dashboardShell');

  return (
    <aside className="w-[240px] h-screen bg-[#18181B] border-r border-[#484750] flex flex-col z-50 fixed left-0 top-0" aria-label={t('sidebar.label')}>
      {/* Brand */}
      <div className="px-6 py-6 flex items-center gap-2">
        <div className="relative">
          <span className="text-2xl font-black text-[#c3c3ee] tracking-tighter">
            Sophia
          </span>
          <div className="absolute -top-1 -right-1.5 w-1.5 h-1.5 bg-[#6366F1] rounded-full" />
        </div>
        <span className="text-[10px] uppercase tracking-widest text-[#76747f] font-bold mt-2 ml-1">
          AI Factory
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-6 mt-4" aria-label={t('sidebar.main')}>
        {/* Main Section */}
        <div>
          <p className="px-4 text-[11px] font-bold text-[#76747f] uppercase tracking-[0.1em] mb-2">
            {t('sidebar.main')}
          </p>
          <div className="space-y-1">
            {MAIN_NAV.map((item) => (
              <NavLink key={item.label} item={item} />
            ))}
          </div>
        </div>

        {/* Management Section */}
        <div>
          <p className="px-4 text-[11px] font-bold text-[#76747f] uppercase tracking-[0.1em] mb-2">
            {t('sidebar.management')}
          </p>
          <div className="space-y-1">
            {MANAGEMENT_NAV.map((item) => (
              <NavLink key={item.label} item={item} />
            ))}
          </div>
        </div>

        {/* Admin Panel Section */}
        <div>
          <p className="px-4 text-[11px] font-bold text-[#76747f] uppercase tracking-[0.1em] mb-2">
            {t('sidebar.adminPanel')}
          </p>
          <div className="space-y-1">
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.label} item={item} />
            ))}
          </div>
        </div>
      </nav>

      {/* Profile Footer */}
      <div className="p-4 border-t border-[#484750] bg-[#131318]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#4e4f74] flex items-center justify-center text-[#c3c3ee] font-bold text-xs flex-shrink-0" aria-hidden="true">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-[#e7e4f0] truncate">
                {userName || 'User'}
              </p>
              <p className="text-xs text-[#acaab5] truncate">
                {userEmail || 'user@sophia.ai'}
              </p>
            </div>
          </div>
          <button
            className="text-[#acaab5] hover:text-[#f97386] transition-colors p-1"
            aria-label={t('sidebar.logout')}
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ───────────────────────────────────────────────────────────────
 * TopBar — header with search, locale, notifications
 * ─────────────────────────────────────────────────────────────── */

function TopBar() {
  const t = useTranslations('stitch.dashboardShell');

  return (
    <header className="h-16 bg-[#18181B] border-b border-[#484750] flex items-center justify-between px-4 md:px-8 z-40 fixed top-0 right-0 left-[240px]">
      {/* Search */}
      <div className="relative w-full md:w-[240px]">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#acaab5] w-4 h-4 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder={t('header.searchPlaceholder')}
          className="w-full bg-[#191920] rounded-lg pl-10 pr-4 py-2 text-sm text-[#e7e4f0] border border-[#484750] focus:outline-none focus:ring-1 focus:ring-[#c3c3ee] focus:border-[#c3c3ee] placeholder:text-[#acaab5]/50 transition-colors"
          aria-label={t('header.searchPlaceholder')}
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-6">
        {/* Locale Toggle */}
        <div className="hidden sm:flex items-center gap-2 bg-[#191920] p-1 rounded-lg border border-[#484750]">
          <button
            className="px-2 py-0.5 text-xs font-bold bg-[#4e4f74] text-[#c3c3ee] rounded shadow-sm"
            aria-label={t('header.localeEnglish')}
          >
            US EN
          </button>
          <button
            className="px-2 py-0.5 text-xs font-medium text-[#acaab5] hover:text-[#e7e4f0]"
            aria-label={t('header.localeVietnamese')}
          >
            VN VI
          </button>
        </div>

        {/* Notifications */}
        <button
          className="relative text-[#acaab5] hover:text-[#e7e4f0] transition-colors p-1.5 rounded-full hover:bg-[#25252e]"
          aria-label={t('header.notifications')}
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#f97386] rounded-full border-2 border-[#18181B]" />
        </button>

        <div className="h-6 w-px bg-[#484750]" aria-hidden="true" />

        {/* Upgrade + Avatar */}
        <div className="flex items-center gap-3">
          <button className="bg-[#6366F1] hover:brightness-110 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-[#6366F1]/30 transition-all hover:scale-105 active:scale-95">
            {t('header.upgradePlan')}
          </button>
          <div className="w-8 h-8 rounded-full border-2 border-[#484750] bg-[#4e4f74] flex items-center justify-center text-[#c3c3ee] font-bold text-xs" aria-hidden="true">
            U
          </div>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────────────────────────────────────────────
 * DashboardContent — main content area
 * ─────────────────────────────────────────────────────────────── */

function DashboardContent({
  welcomeName,
  activeCampaigns,
  totalImpressions,
  engagementRate,
  avgConversion,
  activeRenders,
  gpuUsed,
  gpuTotal,
  projects,
}: {
  welcomeName?: string;
  activeCampaigns?: number;
  totalImpressions?: string;
  engagementRate?: string;
  avgConversion?: string;
  activeRenders?: number;
  gpuUsed?: number;
  gpuTotal?: number;
  projects?: ProjectCard[];
}) {
  const t = useTranslations('stitch.dashboardShell');
  const gpuPercent = gpuTotal && gpuUsed ? Math.round((gpuUsed / gpuTotal) * 100) : 85;

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative bg-[#0e0e12]">
      <div className="max-w-[1400px] mx-auto">
        {/* Breadcrumbs */}
        <nav aria-label={t('breadcrumb.label')} className="flex items-center gap-2 text-xs text-[#acaab5] mb-6">
          <a href="/" className="hover:text-[#e7e4f0] transition-colors">
            {t('breadcrumb.home')}
          </a>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="text-[#e7e4f0] font-medium">{t('breadcrumb.dashboard')}</span>
        </nav>

        {/* Hero + GPU Credits row */}
        <div className="grid grid-cols-12 gap-6">
          {/* Hero Bento Card */}
          <div className="col-span-12 lg:col-span-8 p-4 md:p-6 lg:p-8 rounded-xl bg-gradient-to-br from-[#1f1f26] to-[#191920] relative overflow-hidden border border-[#484750]/30">
            <div className="relative z-10">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight mb-2 text-[#e7e4f0]">
                {t('welcome.heading', { name: welcomeName || 'Jane' })}
              </h1>
              <p className="text-[#acaab5] text-sm md:text-base lg:text-lg max-w-md">
                {t.rich('welcome.description', {
                  count: activeCampaigns ?? 12,
                  bold: (chunks: React.ReactNode) => (
                    <span className="text-[#c3c3ee] font-bold">{chunks}</span>
                  ),
                })}
              </p>
              <div className="mt-8 flex gap-4 flex-wrap">
                <button
                  className="bg-[#6366F1] hover:brightness-110 text-white px-6 py-3 min-h-[44px] rounded-xl font-bold shadow-xl shadow-[#6366F1]/30 active:scale-95 transition-all"
                  aria-label={t('welcome.newProject')}
                >
                  <Play className="w-5 h-5 mr-2 inline-block align-middle" aria-hidden="true" />
                  {t('welcome.newProject')}
                </button>
                <button className="bg-white/5 border border-white/10 text-[#e7e4f0] px-6 py-3 min-h-[44px] rounded-xl font-bold hover:bg-white/10 backdrop-blur-md transition-colors">
                  {t('welcome.viewAnalytics')}
                </button>
              </div>
            </div>
          </div>

          {/* GPU Credits Card */}
          <div className="col-span-12 lg:col-span-4 p-4 md:p-6 rounded-xl bg-[#191920] border border-[#484750]/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-[#76747f] uppercase tracking-wider">
                  {t('gpuCredits.title')}
                </span>
                <Zap className="w-5 h-5 text-[#c3c3ee]" aria-hidden="true" />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl md:text-3xl font-black text-[#e7e4f0]">
                  {gpuUsed?.toLocaleString() || '42,800'}
                </span>
                <span className="text-[#acaab5] text-sm pb-1">
                  / {gpuTotal?.toLocaleString() || '50k'}
                </span>
              </div>
              <div
                className="w-full h-2 mt-4 bg-[#25252e] rounded-full"
                role="progressbar"
                aria-valuenow={gpuPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('gpuCredits.ariaLabel', { percent: gpuPercent })}
              >
                <div
                  className="h-full rounded-full bg-[#c3c3ee] shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all"
                  style={{ width: `${gpuPercent}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-[#acaab5] mt-4">
              {t('gpuCredits.resetsIn', { days: 14 })}{' '}
              <a href="/billing" className="text-[#c3c3ee] font-medium hover:underline">
                {t('gpuCredits.buyMore')}
              </a>
            </p>
          </div>

          {/* Stats Grid - KPI Cards */}
          {([
            { key: 'impressions', icon: Eye, value: totalImpressions || '1.2M' },
            { key: 'engagement', icon: Heart, value: engagementRate || '8.4%' },
            { key: 'avgConversion', icon: GitCompare, value: avgConversion || '2.1%' },
            { key: 'activeRenders', icon: Timer, value: String(activeRenders ?? 12) },
          ] as const).map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.key}
                className="col-span-12 md:col-span-3 p-4 md:p-6 rounded-xl bg-[#191920] border border-[#484750]/30 flex items-center gap-4 hover:border-[#c3c3ee]/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-[#c3c3ee]/10 text-[#c3c3ee]">
                  <Icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-[#acaab5] font-bold uppercase tracking-wide">
                    {t(`stats.${stat.key}`)}
                  </p>
                  <p className="text-2xl md:text-3xl font-bold text-[#e7e4f0]">{stat.value}</p>
                </div>
              </div>
            );
          })}

          {/* Recent Projects */}
          <div className="col-span-12 p-4 md:p-6 rounded-xl bg-[#191920] border border-[#484750]/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg md:text-xl font-bold text-[#e7e4f0]">{t('recentProjects.title')}</h2>
              <a href="/projects" className="text-[#c3c3ee] text-sm font-bold hover:underline">
                {t('recentProjects.viewAll')}
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {projects?.map((project) => (
                <a
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group cursor-pointer"
                  aria-label={project.title}
                >
                  <div className="aspect-video rounded-lg overflow-hidden relative mb-3 bg-[#131318]">
                    <div className="w-full h-full bg-gradient-to-br from-[#131318] to-[#191920]" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                        <Play className="w-5 h-5 text-white" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 backdrop-blur text-[10px] rounded font-bold text-white">
                      {project.duration}
                    </div>
                  </div>
                  <h3 className="font-bold text-[15px] text-[#e7e4f0] truncate">{project.title}</h3>
                  <p className="text-xs text-[#acaab5]">{project.modifiedLabel}</p>
                </a>
              ))}

              {/* Create New Card */}
              <a
                href="/projects/new"
                className="group aspect-video rounded-lg border-2 border-dashed border-[#484750] flex flex-col items-center justify-center gap-2 hover:border-[#c3c3ee]/50 hover:bg-[#c3c3ee]/5 transition-all cursor-pointer"
                aria-label={t('recentProjects.createNew')}
              >
                <div className="w-10 h-10 bg-[#25252e] rounded-full flex items-center justify-center group-hover:bg-[#c3c3ee]/20 transition-colors">
                  <Plus className="w-5 h-5 text-[#acaab5] group-hover:text-[#c3c3ee]" aria-hidden="true" />
                </div>
                <span className="text-sm font-bold text-[#acaab5] group-hover:text-[#c3c3ee]">
                  {t('recentProjects.createNew')}
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ───────────────────────────────────────────────────────────────
 * DashboardShell — Main export
 * ─────────────────────────────────────────────────────────────── */

export default function DashboardShell({
  loading,
  userName,
  userEmail,
  welcomeName,
  activeCampaigns,
  totalImpressions,
  engagementRate,
  avgConversion,
  activeRenders,
  gpuUsed,
  gpuTotal,
  projects,
  children,
}: DashboardShellProps) {
  const t = useTranslations('stitch.dashboardShell');

  if (loading) {
    return (
      <div className="flex h-screen bg-[#0e0e12]">
        <div className="w-[240px] h-full bg-[#18181B] border-r border-[#484750] p-6 space-y-6">
          <div className="h-8 w-32 bg-[#25252e]/50 rounded animate-pulse" />
          <div className="space-y-3">
            <div className="h-4 w-20 bg-[#25252e]/50 rounded animate-pulse" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-full bg-[#25252e]/50 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="space-y-3">
            <div className="h-4 w-20 bg-[#25252e]/50 rounded animate-pulse" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 w-full bg-[#25252e]/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="h-16 w-full bg-[#18181B] animate-pulse" />
          <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            <div className="h-8 w-48 bg-[#25252e]/50 rounded animate-pulse" />
            <div className="h-48 w-full bg-[#25252e]/50 rounded-xl animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 bg-[#25252e]/50 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-[#0e0e12] text-[#e7e4f0]">
      <Sidebar userName={userName} userEmail={userEmail} />
      <div className="flex-1 flex flex-col relative overflow-hidden ml-[240px]">
        <TopBar />
        {children ? (
          children
        ) : (
          <DashboardContent
            welcomeName={welcomeName}
            activeCampaigns={activeCampaigns}
            totalImpressions={totalImpressions}
            engagementRate={engagementRate}
            avgConversion={avgConversion}
            activeRenders={activeRenders}
            gpuUsed={gpuUsed}
            gpuTotal={gpuTotal}
            projects={projects}
          />
        )}
      </div>
    </div>
  );
}

export type { DashboardShellProps, NavItem, ProjectCard };
