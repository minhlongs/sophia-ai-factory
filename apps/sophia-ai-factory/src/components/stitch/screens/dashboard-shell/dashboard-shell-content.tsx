'use client';

import React from 'react';
import { Eye, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import type { ProjectCard } from './dashboard-shell-types';
import { DashboardStats } from './dashboard-shell-stats';

/* ───────────────────────────────────────────────────────────────
 * DashboardContent — scrollable main content area
 * ─────────────────────────────────────────────────────────────── */

export function DashboardContent({
  userName,
  activeCampaigns,
  totalImpressions,
  engagementRate,
  avgConversion,
  activeRenders,
  gpuUsed,
  gpuTotal,
  projects,
}: {
  userName?: string;
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
          <h1 className="text-2xl font-black text-on-surface tracking-tight">
            {t('heading')} {userName ? `${userName}` : ''}
          </h1>
          <p className="text-sm text-on-surface-variant max-w-2xl">
            {t('description')}
          </p>
        </div>

        {/* KPI Stats Grid */}
        <DashboardStats
          activeCampaigns={activeCampaigns}
          totalImpressions={totalImpressions}
          engagementRate={engagementRate}
          avgConversion={avgConversion}
          activeRenders={activeRenders}
          gpuUsed={gpuUsed}
          gpuTotal={gpuTotal}
        />

        {/* Recent Projects */}
        <section className="space-y-4">
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
            {(projects ?? []).map((project) => (
              <div
                key={project.id}
                className="group bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden hover:border-primary/50 transition-all cursor-pointer"
              >
                <div className="aspect-video bg-gradient-to-br from-surface-container to-surface-container-low relative overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-surface-container-lowest to-surface-container" />
                  {project.isRendering && (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface/60 backdrop-blur-sm">
                      <svg className="w-8 h-8 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Eye className="w-5 h-5" />
                  </div>
                  <span className="absolute top-2 right-2 text-xs bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded font-normal">
                    {project.duration}
                  </span>
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
                          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : null}
                        <span className="text-xs">{project.statusLabel}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
            <Link href="/help" className="hover:text-primary transition-colors">
              {t('footer.help')}
            </Link>
          </div>
          <span>{t('footer.copyright')}</span>
        </div>
      </div>
    </div>
  );
}
