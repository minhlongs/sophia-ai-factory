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
  Monitor,
  History,
  Activity,
  Search,
  Bell,
  LogOut,
  Zap,
  Eye,
  Heart,
  GitCompare,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/seed/navigation';
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
  duration: string;
  modifiedLabel: string;
  statusLabel?: string;
  isRendering?: boolean;
}

interface DashboardShellProps {
  /** Sidebar loading state */
  loading?: boolean;
  /** Current user name */
  userName?: string;
  /** Current user email */
  userEmail?: string;
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
    <Link
      href={item.href}
      aria-label={t(`sidebar.${item.label}`)}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded transition-colors text-sm font-medium',
        item.active
          ? 'bg-gradient-to-r from-primary/10 to-transparent border-r-2 border-primary text-primary font-semibold'
          : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span>{t(`sidebar.${item.label}`)}</span>
    </Link>
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
    <aside
      className="fixed left-0 top-0 h-screen w-60 bg-surface-container-low border-r border-outline-variant flex flex-col z-50"
      aria-label={t('sidebar.label')}
    >
      {/* Logo / Brand */}
      <div className="px-6 py-8 flex items-center gap-2">
        <div className="relative">
          <span className="text-xl font-black text-primary tracking-tight">
            Sophia
          </span>
          <div className="absolute -top-1 -right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
        </div>
        <span className="text-xs font-bold text-on-surface-variant/50 mt-1 ml-1 tracking-widest uppercase">
          Factory
        </span>
      </div>

      {/* Navigation clusters */}
      <div className="flex-1 overflow-y-auto px-3 space-y-8">
        {/* Main */}
        <nav>
          <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            {t('sidebar.main')}
          </h3>
          <ul className="space-y-1">
            {MAIN_NAV.map((item) => (
              <li key={item.label}>
                <NavLink item={item} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Management */}
        <nav>
          <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            {t('sidebar.management')}
          </h3>
          <ul className="space-y-1">
            {MANAGEMENT_NAV.map((item) => (
              <li key={item.label}>
                <NavLink item={item} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Admin Panel */}
        <nav>
          <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            {t('sidebar.adminPanel')}
          </h3>
          <ul className="space-y-1">
            {ADMIN_NAV.map((item) => (
              <li key={item.label}>
                <NavLink item={item} />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* User profile footer */}
      <div className="p-4 border-t border-outline-variant bg-surface-container-low">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div
              className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs flex-shrink-0"
              aria-hidden="true"
            >
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-bold text-on-surface truncate">
                {userName || 'User'}
              </p>
              <p className="text-[10px] text-on-surface-variant truncate">
                {userEmail || 'user@sophia.ai'}
              </p>
            </div>
          </div>
          <button
            className="text-on-surface-variant hover:text-error transition-colors p-1 flex-shrink-0"
            aria-label={t('sidebar.logout')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ───────────────────────────────────────────────────────────────
 * TopBar — header with search, locale toggle, notifications
 * ─────────────────────────────────────────────────────────────── */

function TopBar() {
  const t = useTranslations('stitch.dashboardShell');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const isEnglish = locale === 'en';

  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 bg-surface border-b border-outline-variant sticky top-0 z-40">
      {/* Search */}
      <div className="relative w-64">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder={t('header.searchPlaceholder')}
          className="w-full bg-surface-container rounded-md border-none pl-10 pr-4 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/40 transition-all"
          aria-label={t('header.searchPlaceholder')}
        />
      </div>

      {/* Right section */}
      <div className="flex items-center gap-6">
        {/* Locale Toggle */}
        <div className="flex items-center bg-surface-container-high rounded p-1">
          <button
            onClick={() => switchLocale('en')}
            className={cn(
              'px-2 py-0.5 text-[10px] font-bold rounded shadow-sm transition-colors',
              isEnglish
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
            aria-label={t('header.localeEnglish')}
          >
            EN
          </button>
          <button
            onClick={() => switchLocale('vi')}
            className={cn(
              'px-2 py-0.5 text-[10px] font-bold rounded shadow-sm transition-colors',
              !isEnglish
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
            aria-label={t('header.localeVietnamese')}
          >
            VI
          </button>
        </div>

        {/* Notifications */}
        <button
          className="relative text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label={t('header.notifications')}
        >
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error border-2 border-surface rounded-full" />
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pl-4 border-l border-outline-variant">
          <button className="bg-primary-container text-on-primary-container px-4 py-1.5 rounded-md text-sm font-bold hover:opacity-90 active:scale-95 transition-all">
            {t('header.generate')}
          </button>
          <button className="text-primary hover:bg-primary/10 px-4 py-1.5 rounded-md text-sm font-bold transition-all">
            {t('header.upgradePlan')}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────────────────────────────────────────────
 * DashboardContent — scrollable main content area
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
  const gpuPercent = gpuTotal && gpuUsed ? Math.round((gpuUsed / gpuTotal) * 100) : 70;
  const projectCount = projects?.length ?? 24;

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background">
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Breadcrumbs & heading */}
        <div className="space-y-2">
          <nav
            className="flex items-center gap-2 text-[13px] text-on-surface-variant/60"
            aria-label={t('breadcrumb.label')}
          >
            <Link href="/" className="hover:text-primary transition-colors">
              {t('breadcrumb.home')}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="text-on-surface-variant">
              {t('breadcrumb.dashboard')}
            </span>
          </nav>
          <h1 className="text-3xl font-black text-on-surface">
            {t('welcome.heading', { name: welcomeName || 'Jane' })}
          </h1>
          <p className="text-on-surface-variant text-sm">
            {t.rich('welcome.description', {
              count: activeCampaigns ?? 12,
              bold: (chunks: React.ReactNode) => (
                <span className="text-primary font-semibold">{chunks}</span>
              ),
            })}
          </p>
        </div>

        {/* Bento grid stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* GPU Credits */}
          <div className="glass-card p-5 rounded-xl space-y-3 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('gpuCredits.title')}
              </span>
              <Zap className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-on-surface">
                {gpuUsed?.toLocaleString() ?? '42,850'}
              </span>
              <span className="text-[10px] text-primary">+12%</span>
            </div>
            <div
              className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={gpuPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('gpuCredits.ariaLabel', { percent: gpuPercent })}
            >
              <div
                className="bg-primary h-full w-[70%] rounded-full transition-all"
              />
            </div>
          </div>

          {/* Impressions */}
          <div className="glass-card p-5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('stats.impressions')}
              </span>
              <Eye className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-on-surface">
                {totalImpressions || '1.2M'}
              </span>
              <span className="text-[10px] text-primary">+5.4%</span>
            </div>
            <p className="text-[10px] text-on-surface-variant">
              {t('stats.last30Days')}
            </p>
          </div>

          {/* Engagement */}
          <div className="glass-card p-5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('stats.engagement')}
              </span>
              <Heart className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-on-surface">
                {engagementRate || '18.2%'}
              </span>
              <span className="text-[10px] text-error">-0.8%</span>
            </div>
            <div className="flex gap-1 h-4 items-end">
              <div className="w-1 bg-primary h-[40%] rounded-t-sm" />
              <div className="w-1 bg-primary h-[60%] rounded-t-sm" />
              <div className="w-1 bg-primary h-[80%] rounded-t-sm" />
              <div className="w-1 bg-primary h-[70%] rounded-t-sm" />
              <div className="w-1 bg-primary h-[90%] rounded-t-sm" />
            </div>
          </div>

          {/* Avg Conversion */}
          <div className="glass-card p-5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('stats.avgConversion')}
              </span>
              <GitCompare className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-on-surface">
                {avgConversion || '4.8%'}
              </span>
              <span className="text-[10px] text-primary">+2.1%</span>
            </div>
            <p className="text-[10px] text-on-surface-variant">
              {t('stats.industryAvg')}
            </p>
          </div>

          {/* Active Renders */}
          <div className="glass-card p-5 rounded-xl space-y-3 bg-primary-container/20 border-primary/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                {t('stats.activeRenders')}
              </span>
              <svg
                className="w-5 h-5 text-primary animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-on-surface">
                {activeRenders ?? 14}
              </span>
            </div>
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-surface-container-highest border border-outline-variant" />
              <div className="w-6 h-6 rounded-full bg-surface-container-high border border-outline-variant" />
              <div className="w-6 h-6 rounded-full bg-primary border border-outline-variant flex items-center justify-center text-[8px] font-bold text-on-primary">
                +12
              </div>
            </div>
          </div>
        </div>

        {/* Recent Projects */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              {t('recentProjects.title')}
              <span className="text-xs bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded font-normal">
                {projectCount} Total
              </span>
            </h2>
            <Link
              href="/projects"
              className="text-sm text-primary font-semibold flex items-center gap-1 hover:underline"
            >
              {t('recentProjects.viewAll')}
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {projects?.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden hover:border-primary/50 transition-all cursor-pointer"
                aria-label={project.title}
              >
                <div className="relative aspect-video">
                  <div className="w-full h-full bg-gradient-to-br from-surface-container-lowest to-surface-container" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-10 h-10 text-white" aria-hidden="true" />
                  </div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-bold text-white">
                    {project.duration}
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <h4 className="font-bold text-on-surface text-sm truncate">
                    {project.title}
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-on-surface-variant">
                      {project.modifiedLabel}
                    </span>
                    {project.statusLabel && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-primary">
                        {project.isRendering ? (
                          <svg
                            className="w-3.5 h-3.5 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                            <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg
                            className="w-3.5 h-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        )}
                        {project.statusLabel}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}

            {/* Create New Project */}
            <Link
              href="/projects/new"
              className="group border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center gap-3 p-6 hover:bg-surface-container hover:border-primary/40 transition-all cursor-pointer"
              aria-label={t('recentProjects.createNew')}
            >
              <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="text-center">
                <p className="font-bold text-on-surface text-sm">
                  {t('recentProjects.createNew')}
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  {t('recentProjects.startPrompt')}
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-8 border-t border-outline-variant flex flex-col md:flex-row justify-between items-center gap-4 text-on-surface-variant/40 text-[11px]">
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              {t('footer.privacy')}
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors">
              {t('footer.terms')}
            </Link>
            <Link href="/docs" className="hover:text-primary transition-colors">
              {t('footer.documentation')}
            </Link>
          </div>
          <p>{t('footer.copyright', { year: '2024' })}</p>
        </div>
      </div>
    </div>
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
  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        {/* Sidebar skeleton */}
        <div className="w-60 h-full bg-surface-container-low border-r border-outline-variant p-6 space-y-6">
          <div className="h-8 w-32 bg-surface-container-highest/50 rounded animate-pulse" />
          <div className="space-y-3">
            <div className="h-4 w-20 bg-surface-container-highest/50 rounded animate-pulse" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-full bg-surface-container-highest/50 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="space-y-3">
            <div className="h-4 w-20 bg-surface-container-highest/50 rounded animate-pulse" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 w-full bg-surface-container-highest/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="h-16 w-full bg-surface animate-pulse" />
          <div className="flex-1 p-8 space-y-6">
            <div className="h-8 w-48 bg-surface-container-highest/50 rounded animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-32 bg-surface-container-highest/50 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="h-48 w-full bg-surface-container-highest/50 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-background text-on-surface">
      <Sidebar userName={userName} userEmail={userEmail} />
      <div className="flex-1 flex flex-col relative overflow-hidden ml-60">
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
