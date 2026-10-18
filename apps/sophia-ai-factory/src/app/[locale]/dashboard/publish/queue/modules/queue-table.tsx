'use client';

import React from 'react';
import { Send } from 'lucide-react';
import { EmptyState } from '@/seed/components/ui/empty-state';
import { type PublishJob } from './types';
import {
  QueueTableRow,
  type QueueTableRowProps,
  formatPublishQueueDate,
  formatPublishTarget,
} from './queue-table-row';

export { QueueTableRow, type QueueTableRowProps, formatPublishQueueDate, formatPublishTarget };

export interface QueueTableProps {
  jobs: PublishJob[];
  locale: string;
  approvingJobId: string | null;
  onApprove: (id: string) => void;
  onRetry: (id: string) => void;
  t: (key: string) => string;
}

export function QueueTable({
  jobs,
  locale,
  approvingJobId,
  onApprove,
  onRetry,
  t,
}: QueueTableProps) {
  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title={t('empty.title') || 'No Publish Jobs Yet'}
        description={
          t('empty.message') ||
          'Schedule your first WhatsApp publish from the video editor or setup wizard.'
        }
        cta={{
          label: t('empty.cta') || 'Create WhatsApp Template',
          href: '/dashboard/setup/whatsapp-templates',
        }}
        className="border-0 rounded-none bg-transparent py-12"
      />
    );
  }

  return (
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
          {jobs.map((job) => (
            <QueueTableRow
              key={job.id}
              job={job}
              locale={locale}
              approvingJobId={approvingJobId}
              onApprove={onApprove}
              onRetry={onRetry}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
