'use client';

/**
 * Simple Customer Pilot Feedback & Issue Report card.
 *
 * Captures usefulness rating, editing friction, or bug reports scoped to the
 * customer's organization without external forms or third-party trackers.
 *
 * @module components/first-value/first-value-feedback-card
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PilotFeedbackSummary } from '@/seed/pilot/pilot-access-policy';

export type PilotFeedbackCategory = 'usefulness' | 'editing_friction' | 'bug_report' | 'other';

export interface FirstValueFeedbackCardProps {
  readonly busy: boolean;
  readonly artifactId: string | null;
  readonly feedbackItems?: readonly PilotFeedbackSummary[];
  readonly onSubmitFeedback: (input: {
    readonly rating: number;
    readonly category: PilotFeedbackCategory;
    readonly comment: string;
  }) => Promise<boolean>;
}

export function FirstValueFeedbackCard({
  busy,
  artifactId,
  feedbackItems = [],
  onSubmitFeedback,
}: FirstValueFeedbackCardProps) {
  const t = useTranslations('firstValue');
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState<PilotFeedbackCategory>('usefulness');
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!comment.trim()) return;
    const ok = await onSubmitFeedback({
      rating,
      category,
      comment: comment.trim(),
    });
    if (ok) {
      setComment('');
      setSubmitted(true);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">{t('feedbackTitle')}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('feedbackSubtitle')}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('feedbackRatingLabel')}
          <select
            value={rating}
            disabled={busy}
            onChange={(e) => setRating(Number(e.target.value))}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value={5}>5 — {t('feedbackRating5')}</option>
            <option value={4}>4 — {t('feedbackRating4')}</option>
            <option value={3}>3 — {t('feedbackRating3')}</option>
            <option value={2}>2 — {t('feedbackRating2')}</option>
            <option value={1}>1 — {t('feedbackRating1')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('feedbackCategoryLabel')}
          <select
            value={category}
            disabled={busy}
            onChange={(e) => setCategory(e.target.value as PilotFeedbackCategory)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="usefulness">{t('feedbackCatUsefulness')}</option>
            <option value="editing_friction">{t('feedbackCatEditing')}</option>
            <option value="bug_report">{t('feedbackCatBug')}</option>
            <option value="other">{t('feedbackCatOther')}</option>
          </select>
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
        {t('feedbackCommentLabel')}
        <textarea
          rows={3}
          maxLength={2000}
          value={comment}
          disabled={busy}
          onChange={(e) => {
            setComment(e.target.value);
            if (submitted) setSubmitted(false);
          }}
          placeholder={t('feedbackCommentPlaceholder')}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={busy || comment.trim().length === 0}
          onClick={() => void handleSubmit()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t('loading') : t('feedbackSubmitBtn')}
        </button>
        {artifactId && (
          <span className="font-mono text-xs text-muted-foreground">
            {t('feedbackLinkedArtifact')}: {artifactId}
          </span>
        )}
      </div>

      {submitted && (
        <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {t('feedbackSubmittedSuccess')}
        </p>
      )}

      {feedbackItems.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {t('feedbackHistoryTitle')}
          </h3>
          <div className="mt-2.5 space-y-2.5">
            {feedbackItems.map((item) => {
              const statusLabel =
                item.status === 'resolved'
                  ? t('feedbackStatusResolved')
                  : item.status === 'in_progress'
                    ? t('feedbackStatusInProgress')
                    : t('feedbackStatusReceived');
              const statusTone =
                item.status === 'resolved'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : item.status === 'in_progress'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-border bg-muted text-muted-foreground';
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-background p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-muted-foreground">
                      {item.rating}/5 • {item.createdAtIso.slice(0, 10)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-foreground">{item.comment}</p>
                  {item.operatorReply && (
                    <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-foreground">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                        {t('feedbackOperatorReplyLabel')}:{' '}
                      </span>
                      {item.operatorReply}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
