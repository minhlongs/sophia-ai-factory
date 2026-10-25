'use client';

/**
 * Main preview region.
 *
 * Renders the selected image artifact, metadata footer, remix action, and
 * authenticated download button.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ImageJobView } from '@/tree/creative-studio/image-job-view-model';
import { ImagePreviewBody } from './image-preview-body';

export interface SelectedStatus {
  status: string;
  resultUrl: string | null;
}

export function ImagePreviewPanel({
  job,
  selectedStatus,
  statusError,
  onRetryStatus,
  onRemixJob,
}: {
  job: ImageJobView | null;
  selectedStatus: SelectedStatus | null;
  statusError: string | null;
  onRetryStatus: () => void;
  onRemixJob?: (job: ImageJobView) => void;
}) {
  const t = useTranslations('imageStudio');
  const [imageError, setImageError] = useState(false);

  // Clear the per-selection image error when the user selects a different job.
  const activeJobId = job?.id ?? null;
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  if (activeJobId !== lastJobId) {
    setLastJobId(activeJobId);
    setImageError(false);
  }

  if (!job) {
    return (
      <div className="flex h-full min-h-[18rem] items-center justify-center rounded-xl border border-dashed border-border bg-surface-container-lowest p-8 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">{t('preview.emptyTitle')}</p>
      </div>
    );
  }

  const resultUrl = selectedStatus?.resultUrl ?? job.resultUrl;
  const canDownload = job.stage === 'done' && Boolean(resultUrl);
  const canRemix = Boolean(job.prompt && job.prompt.trim().length > 0 && onRemixJob);

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-surface-container-high">
        <ImagePreviewBody
          job={job}
          resultUrl={resultUrl}
          imageError={imageError}
          onImageError={() => setImageError(true)}
          onRetryImage={() => setImageError(false)}
          statusError={statusError}
          onRetryStatus={onRetryStatus}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <dl className="grid flex-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="flex gap-1">
            <dt className="font-medium text-foreground">{t('preview.modelLabel')}</dt>
            <dd>{job.model}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-medium text-foreground">{t('preview.statusLabel')}</dt>
            <dd>{t(`status.${job.stage}`)}</dd>
          </div>
        </dl>

        {(canRemix || canDownload) && (
          <div className="flex flex-wrap items-center gap-2">
            {canRemix && onRemixJob && (
              <button
                type="button"
                onClick={() => onRemixJob(job)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                {t('preview.remixPrompt')}
              </button>
            )}
            {canDownload && (
              <a
                href={`/api/v1/creative-studio/images/${encodeURIComponent(job.id)}/download`}
                download
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                {t('preview.downloadImage')}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
