'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import {
  type PublishJob,
  QueueApprovalBanner,
  QueueTable,
  QueueLegend,
} from './modules';

export function PublishQueueClient() {
  const t = useTranslations('publish.queue');
  const common = useTranslations('common');
  const locale = useLocale();
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApprovalBanner, setShowApprovalBanner] = useState(false);
  const [approvingJobId, setApprovingJobId] = useState<string | null>(null);

  const fetchJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/${locale}/api/publish/queue`);
      if (!response.ok) {
        throw new Error('Failed to fetch publish queue');
      }
      const data = (await response.json()) as { jobs: PublishJob[]; showApprovalBanner: boolean };
      setJobs(data.jobs || []);
      setShowApprovalBanner(data.showApprovalBanner || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [locale]);

  const handleApprove = async (jobId: string) => {
    setApprovingJobId(jobId);
    try {
      const response = await fetch(`/${locale}/api/publish/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Approval failed');
      }

      await fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApprovingJobId(null);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const response = await fetch(`/${locale}/api/publish/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Retry failed');
      }

      await fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Retry failed');
    }
  };

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
              {t('subtitle') || 'Monitor and manage your WhatsApp publish jobs'}
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
