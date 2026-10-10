'use client';

import React from 'react';
import {
  ChevronRight,
  PlusCircle,
  BarChart,
  FileText,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export function QuickActions() {
  const t = useTranslations('stitch.dashboardOverview');

  return (
    <section aria-label={t('aria.quickActions')} className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4 px-1">
        {t('quickActions.title')}
      </h3>

      <button
        className="w-full flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-all group text-left"
        aria-label={t('quickActions.createCampaign')}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <PlusCircle className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <p className="text-white font-bold">{t('quickActions.createCampaign')}</p>
            <p className="text-xs text-primary/80">{t('quickActions.createCampaignDesc')}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" aria-hidden="true" />
      </button>

      <button
        className="w-full flex items-center justify-between p-4 bg-surface-container border border-outline-variant/10 rounded-xl hover:bg-surface-container-high transition-all group text-left"
        aria-label={t('quickActions.viewAnalytics')}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
            <BarChart className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
          </div>
          <div>
            <p className="text-white font-bold">{t('quickActions.viewAnalytics')}</p>
            <p className="text-xs text-on-surface-variant">{t('quickActions.viewAnalyticsDesc')}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" aria-hidden="true" />
      </button>

      <button
        className="w-full flex items-center justify-between p-4 bg-surface-container border border-outline-variant/10 rounded-xl hover:bg-surface-container-high transition-all group text-left"
        aria-label={t('quickActions.generateReport')}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
            <FileText className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
          </div>
          <div>
            <p className="text-white font-bold">{t('quickActions.generateReport')}</p>
            <p className="text-xs text-on-surface-variant">{t('quickActions.generateReportDesc')}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" aria-hidden="true" />
      </button>

      <button
        className="w-full flex items-center justify-between p-4 bg-surface-container border border-outline-variant/10 rounded-xl hover:bg-surface-container-high transition-all group text-left"
        aria-label={t('quickActions.inviteTeam')}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
          </div>
          <div>
            <p className="text-white font-bold">{t('quickActions.inviteTeam')}</p>
            <p className="text-xs text-on-surface-variant">{t('quickActions.inviteTeamDesc')}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" aria-hidden="true" />
      </button>

      {/* Storage Usage */}
      <div className="mt-8 p-6 bg-surface-container-low border border-outline-variant/5 rounded-2xl">
        <h4 className="text-xs font-black text-on-surface-variant uppercase tracking-widest mb-4">
          {t('storage.title')}
        </h4>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">{t('storage.used', { gb: '82.4' })}</span>
          <span className="text-xs text-on-surface-variant">{t('storage.percent', { pct: '82' })}</span>
        </div>
        <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full rounded-full"
            style={{ width: '82%' }}
            role="progressbar"
            aria-valuenow={82}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('storage.progressLabel', { pct: '82' })}
          />
        </div>
        <p className="text-[10px] text-on-surface-variant mt-3 leading-relaxed">
          {t('storage.upgradeHint')}
        </p>
      </div>
    </section>
  );
}
