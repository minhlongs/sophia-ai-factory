'use client';

/**
 * Main preview region.
 *
 * State honesty rules:
 *  - queued / running → indeterminate progress only. No percentage and no
 *    ETA, because the backend publishes neither.
 *  - completed but the image failed to load → the generation succeeded and
 *    the preview did not. Those are different failures and stay separate.
 *  - unknown status → rendered as unrecognised, never as a success.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import type { ImageJobView } from '@/tree/creative-studio/image-job-view-model';

export interface SelectedStatus {
  status: string;
  resultUrl: string | null;
}

export function ImagePreviewPanel({
  job,
  selectedStatus,
  statusError,
  onRetryStatus,
}: {
  job: ImageJobView | null;
  selectedStatus: SelectedStatus | null;
  statusError: string | null;
  onRetryStatus: () => void;
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

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-surface-container-high">
        <PreviewBody
          job={job}
          resultUrl={resultUrl}
          imageError={imageError}
          onImageError={() => setImageError(true)}
          onRetryImage={() => setImageError(false)}
          statusError={statusError}
          onRetryStatus={onRetryStatus}
        />
      </div>

      <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">{t('preview.modelLabel')}</dt>
          <dd>{job.model}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium text-foreground">{t('preview.statusLabel')}</dt>
          <dd>{t(`status.${job.stage}`)}</dd>
        </div>
      </dl>
    </div>
  );
}

function PreviewBody({
  job,
  resultUrl,
  imageError,
  onImageError,
  onRetryImage,
  statusError,
  onRetryStatus,
}: {
  job: ImageJobView;
  resultUrl: string | null;
  imageError: boolean;
  onImageError: () => void;
  onRetryImage: () => void;
  statusError: string | null;
  onRetryStatus: () => void;
}) {
  const t = useTranslations('imageStudio');

  if (job.stage === 'queued' || job.stage === 'running') {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center">
        <span
          aria-hidden="true"
          className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"
        />
        <p className="text-sm text-muted-foreground">
          {job.stage === 'queued' ? t('status.queuedHint') : t('status.runningHint')}
        </p>
        {statusError !== null && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-destructive">{t('status.statusUnavailable')}</p>
            <button
              type="button"
              onClick={onRetryStatus}
              className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              {t('preview.retryStatus')}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (job.stage === 'done' && resultUrl && !imageError) {
    // Plain <img> on purpose: result URLs may come from fal.ai's CDN or from an
    // R2 bucket, and next/image only permits the configured remote hosts.
    // Optimising a preview must not decide which URLs are loadable.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resultUrl}
        alt={job.prompt || t('preview.generatedImageAlt')}
        className="max-h-full max-w-full object-contain"
        onError={onImageError}
      />
    );
  }

  if (job.stage === 'done' && resultUrl && imageError) {
    return (
      <div className="max-w-sm p-8 text-center">
        <p className="text-sm text-destructive">{t('preview.imageLoadFailedTitle')}</p>
        <button
          type="button"
          onClick={onRetryImage}
          className="mt-3 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          {t('preview.retryLoad')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-sm p-8 text-center">
      <p className="text-sm text-muted-foreground">
        {job.status === 'failed'
          ? t('preview.failedHint')
          : t('preview.unknownStateHint')}
      </p>
      {job.status === 'failed' && (
        <Link
          href="/dashboard/setup"
          className="mt-3 inline-block rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          {t('preview.reviewSetup')}
        </Link>
      )}
    </div>
  );
}
