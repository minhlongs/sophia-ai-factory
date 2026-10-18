'use client';

import React from 'react';
import { Shield, RefreshCw, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import { cn } from '@/tree/components/setup-wizard/wizard-stepper';
import { type PublishJob, STATUS_CONFIG } from './types';

export interface QueueTableRowProps {
  job: PublishJob;
  locale: string;
  approvingJobId: string | null;
  onApprove: (id: string) => void;
  onRetry: (id: string) => void;
  t: (key: string) => string;
}

export function formatPublishQueueDate(timestamp: number, locale: string): string {
  return new Date(timestamp * 1000).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPublishTarget(target: string): string {
  if (target.startsWith('wa:')) {
    return target.replace('wa:', '+');
  }
  return target;
}

export function QueueTableRow({
  job,
  locale,
  approvingJobId,
  onApprove,
  onRetry,
  t,
}: QueueTableRowProps) {
  const statusConfig = STATUS_CONFIG[job.status];

  return (
    <tr className="hover:bg-muted/30 transition-colors">
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
          <span className="text-sm text-foreground">
            {job.templateName || `Template #${job.templateId}`}
          </span>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="text-sm font-mono text-foreground">{formatPublishTarget(job.target)}</span>
      </td>
      <td className="px-4 py-4">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            statusConfig.bg,
            statusConfig.color
          )}
        >
          {statusConfig.icon}
          {t(`status.${job.status}`) || statusConfig.label}
        </span>
      </td>
      <td className="px-4 py-4 text-sm text-muted-foreground">
        {formatPublishQueueDate(job.createdAt, locale)}
      </td>
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {job.status === 'pending_approval' && (
            <Button
              size="sm"
              onClick={() => onApprove(job.id)}
              disabled={approvingJobId === job.id}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {approvingJobId === job.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Shield className="w-3 h-3" />
              )}
              {t('actions.approve') || 'Approve'}
            </Button>
          )}
          {job.status === 'failed' && (
            <Button
              size="sm"
              onClick={() => onRetry(job.id)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="w-3 h-3" />
              {t('actions.retry') || 'Retry'}
            </Button>
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
}
