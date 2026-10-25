'use client';

/**
 * Preview body renderer for Image Studio.
 *
 * State honesty rules:
 *  - queued / running → indeterminate progress only (no fabricated % or ETA).
 *  - completed + loadable → plain <img> for R2 or provider CDN URLs.
 *  - completed + load error → distinct preview load failure state.
 *  - failed / unknown → distinct copy per state.
 */

import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import type { ImageJobView } from '@/tree/creative-studio/image-job-view-model';

export function ImagePreviewBody({
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
