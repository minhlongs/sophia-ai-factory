'use client';

import React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import {
  QueueApprovalBanner,
  QueueTable,
  QueueLegend,
} from './modules';
import { usePublishQueue } from './use-publish-queue';

export function PublishQueueClient() {
  const t = useTranslations('publish.queue');
  const common = useTranslations('common');
  const locale = useLocale();
  const {
    jobs,
    isLoading,
    error,
    showApprovalBanner,
    approvingJobId,
    fetchJobs,
    handleApprove,
    handleRetry,
  } = usePublishQueue(locale);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('loading') || 'Loading publish queue...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('title') || 'Publish Queue'}</h1>
            <p className="text-muted-foreground mt-1">
              {t('subtitle') || 'Monitor and manage omnichannel publish jobs (YouTube, TikTok, Instagram, Facebook, LinkedIn)'}
            </p>
          </div>
          <Button variant="outline" onClick={fetchJobs} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            {common('refresh') || 'Refresh'}
          </Button>
        </div>

        {showApprovalBanner && (
          <QueueApprovalBanner
            title={t('approvalBanner.title')}
            message={t('approvalBanner.message')}
            note={t('approvalBanner.note')}
          />
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchJobs}>
              {common('retry') || 'Retry'}
            </Button>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <QueueTable
            jobs={jobs}
            locale={locale}
            approvingJobId={approvingJobId}
            onApprove={handleApprove}
            onRetry={handleRetry}
            t={t}
          />
        </div>

        <QueueLegend t={t} />
      </div>
    </div>
  );
}
