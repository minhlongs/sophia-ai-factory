'use client';

import { useTranslations } from 'next-intl';
import { AnalyticsDashboard } from './components/analytics-dashboard';

export default function AnalyticsPage() {
  const t = useTranslations('analytics');

  return (
    <div className="space-y-4 p-4 max-w-4xl">
      <h1 className="text-lg font-semibold">{t('title')}</h1>
      <AnalyticsDashboard />
    </div>
  );
}
