'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/navigation';
import { cn } from '@/tree/components/setup-wizard/wizard-stepper';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  MessageCircle,
  Send,
  Shield,
  Loader2,
} from 'lucide-react';

interface PublishJob {
  id: string;
  videoId: string;
  videoTitle: string;
  templateId: number;
  templateName: string;
  target: string;
  status: 'pending' | 'scheduled' | 'sent' | 'failed' | 'pending_approval';
  createdAt: number;
  sentAt?: number;
  errorMessage?: string;
}

const STATUS_CONFIG: Record<PublishJob['status'], { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200',
  },
  scheduled: {
    label: 'Scheduled',
    icon: <Clock className="w-4 h-4" />,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
  },
  sent: {
    label: 'Sent',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
  },
  failed: {
    label: 'Failed',
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
  },
  pending_approval: {
    label: 'Approval Needed',
    icon: <Shield className="w-4 h-4" />,
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
  },
};

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

      // Refresh jobs after approval
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTarget = (target: string) => {
    if (target.startsWith('wa:')) {
      return target.replace('wa:', '+');
    }
    return target;
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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('title') || 'Publish Queue'}</h1>
            <p className="text-muted-foreground mt-1">
              {t('subtitle') || 'Monitor and manage your WhatsApp publish jobs'}
            </p>
          </div>
          <button
            onClick={fetchJobs}
            className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {common('refresh') || 'Refresh'}
          </button>
        </div>

        {/* Approval Gate Banner */}
        {showApprovalBanner && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-800 mb-1">
                  {t('approvalBanner.title') || 'First Publish Requires Approval'}
                </h3>
                <p className="text-orange-700 text-sm mb-3">
                  {t('approvalBanner.message') || 'Your first WhatsApp publish requires explicit approval. Click "Approve" on the pending job to continue.'}
                </p>
                <p className="text-orange-600 text-xs">
                  {t('approvalBanner.note') || 'This is a one-time security measure to prevent accidental sends.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchJobs}
              className="px-3 py-1 text-sm border border-red-300 rounded hover:bg-red-50 transition-colors"
            >
              {common('retry') || 'Retry'}
            </button>
          </div>
        )}

        {/* Jobs Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {jobs.length === 0 ? (
            <div className="p-12 text-center">
              <Send className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                {t('empty.title') || 'No Publish Jobs Yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t('empty.message') || 'Schedule your first WhatsApp publish from the video editor or setup wizard.'}
              </p>
              <Link
                href={`/${locale}/dashboard/setup/whatsapp-templates`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                <MessageCircle className="w-4 h-4" />
                {t('empty.cta') || 'Create WhatsApp Template'}
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('table.video') || 'Video'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('table.template') || 'Template'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('table.target') || 'Target'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('table.status') || 'Status'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('table.created') || 'Created'}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('table.actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.map((job) => {
                    const statusConfig = STATUS_CONFIG[job.status];
                    return (
                      <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-foreground truncate max-w-xs">
                              {job.videoTitle || `Video ${job.videoId.slice(0, 8)}...`}
                            </p>
                            <p className="text-xs text-muted-foreground">{job.videoId}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-foreground">{job.templateName || `Template #${job.templateId}`}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm font-mono text-foreground">{formatTarget(job.target)}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', statusConfig.bg, statusConfig.color)}>
                            {statusConfig.icon}
                            {t(`status.${job.status}`) || statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {formatDate(job.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {job.status === 'pending_approval' && (
                              <button
                                onClick={() => handleApprove(job.id)}
                                disabled={approvingJobId === job.id}
                                className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                {approvingJobId === job.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Shield className="w-3 h-3" />
                                )}
                                {t('actions.approve') || 'Approve'}
                              </button>
                            )}
                            {job.status === 'failed' && (
                              <button
                                onClick={() => handleRetry(job.id)}
                                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                {t('actions.retry') || 'Retry'}
                              </button>
                            )}
                            {job.status === 'sent' && (
                              <span className="px-3 py-1.5 text-xs text-green-600 font-medium">
                                {t('actions.delivered') || 'Delivered'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
          <h4 className="text-sm font-medium text-foreground mb-3">{t('legend.title') || 'Status Legend'}</h4>
          <div className="flex flex-wrap gap-4 text-sm">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <span key={key} className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', config.bg, config.color)}>
                {config.icon}
                {t(`status.${key}`) || config.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}