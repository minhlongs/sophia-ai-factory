'use client';

/**
 * Script review, explicit Accept/Reject controls, and Private Export panel (Track B1.1).
 *
 * @module components/first-value/first-value-review-panel
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';

export interface FirstValueReviewPanelProps {
  readonly review: DurableFirstValueReview | null;
  readonly busy: boolean;
  readonly exportPayload: string | null;
  readonly onAccept: () => Promise<void>;
  readonly onReject: (reason: string) => Promise<void>;
  readonly onExport: (format: 'json' | 'markdown') => Promise<void>;
}

export function FirstValueReviewPanel({
  review,
  busy,
  exportPayload,
  onAccept,
  onReject,
  onExport,
}: FirstValueReviewPanelProps) {
  const t = useTranslations('firstValue');
  const [rejectReason, setRejectReason] = useState('');

  if (!review) {
    return (
      <section className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <h2 className="mb-2 text-base font-semibold text-foreground">{t('reviewTitle')}</h2>
        <p>{t('reviewEmpty')}</p>
      </section>
    );
  }

  const isFinalized = review.reviewState !== 'pending_review';
  const isAccepted = review.reviewState === 'accepted';

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{t('reviewTitle')}</h2>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 font-mono text-xs font-medium text-amber-600 dark:text-amber-400">
            {review.provenanceLabel}
          </span>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">{t('stateLabel')}</dt>
            <dd className="font-mono font-semibold text-foreground">{review.reviewState}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('versionLabel')}</dt>
            <dd className="font-mono font-semibold text-foreground">v{review.version}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('mcuChargedLabel')}</dt>
            <dd className="font-mono font-semibold text-foreground">{review.mcuCharged}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('artifactRefLabel')}</dt>
            <dd className="truncate font-mono text-foreground" title={review.privateArtifactRef}>
              {review.privateArtifactRef}
            </dd>
          </div>
        </dl>

        <h3 className="mb-3 text-sm font-semibold text-foreground">{review.script.title}</h3>
        <div className="flex flex-col gap-3">
          {review.script.scenes.map((scene) => (
            <article
              key={scene.scene_number}
              className="rounded-lg border border-border/80 bg-background p-3 text-sm"
            >
              <div className="mb-1 font-mono text-xs font-medium text-primary">
                {t('sceneHeading')} {scene.scene_number} ({scene.duration_estimate}s)
              </div>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{t('visualLabel')}:</strong>{' '}
                {scene.visual_description}
              </p>
              <p className="mt-1 text-sm text-foreground">
                <strong>{t('narrationLabel')}:</strong> {scene.narration}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
          {isFinalized ? (
            <p className="text-xs font-medium text-muted-foreground">{t('finalizedNotice')}</p>
          ) : (
            <>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('rejectReasonPlaceholder')}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                disabled={busy}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onAccept()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {t('acceptBtn')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onReject(rejectReason)}
                  className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                >
                  {t('rejectBtn')}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-2 text-base font-semibold text-foreground">{t('exportTitle')}</h2>
        {!isAccepted ? (
          <p className="text-sm text-muted-foreground">{t('exportLocked')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onExport('json')}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {t('exportJsonBtn')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onExport('markdown')}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {t('exportMarkdownBtn')}
              </button>
            </div>
            {exportPayload && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {t('exportSuccess')}
                </p>
                <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
                  {exportPayload}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
