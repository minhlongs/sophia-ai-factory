'use client';

/**
 * Simple Customer Pilot Feedback & Issue Report card.
 *
 * Captures usefulness rating, editing friction, or bug reports scoped to the
 * customer's organization without external forms or third-party trackers.
 *
 * @module components/first-value/first-value-feedback-card
 */

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

export type PilotFeedbackCategory = 'usefulness' | 'editing_friction' | 'bug_report' | 'other';

const MAX_SCREENSHOT_BYTES = 500 * 1024;
const ALLOWED_SCREENSHOT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface FirstValueFeedbackCardProps {
  readonly busy: boolean;
  readonly artifactId: string | null;
  readonly onSubmitFeedback: (input: {
    readonly rating: number;
    readonly category: PilotFeedbackCategory;
    readonly comment: string;
    readonly screenshotDataUrl?: string | null;
  }) => Promise<boolean>;
}

export function FirstValueFeedbackCard({
  busy,
  artifactId,
  onSubmitFeedback,
}: FirstValueFeedbackCardProps) {
  const t = useTranslations('firstValue');
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState<PilotFeedbackCategory>('usefulness');
  const [comment, setComment] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleScreenshotFile(file: File | null) {
    setScreenshotError(null);
    if (!file) {
      setScreenshotDataUrl(null);
      setScreenshotName(null);
      return;
    }
    if (!ALLOWED_SCREENSHOT_TYPES.has(file.type)) {
      setScreenshotError(t('feedbackScreenshotInvalidType'));
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setScreenshotError(t('feedbackScreenshotTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setScreenshotDataUrl(reader.result);
        setScreenshotName(file.name);
        if (submitted) setSubmitted(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function clearScreenshot() {
    setScreenshotDataUrl(null);
    setScreenshotName(null);
    setScreenshotError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit() {
    if (!comment.trim()) return;
    const ok = await onSubmitFeedback({
      rating,
      category,
      comment: comment.trim(),
      screenshotDataUrl,
    });
    if (ok) {
      setComment('');
      clearScreenshot();
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

      <div className="mt-3 flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('feedbackScreenshotLabel')}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => handleScreenshotFile(e.target.files?.[0] ?? null)}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-foreground"
          />
        </label>
        {screenshotError && (
          <p role="alert" className="text-xs text-destructive">
            {screenshotError}
          </p>
        )}
        {screenshotDataUrl && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotDataUrl}
              alt={screenshotName ?? 'Feedback screenshot preview'}
              className="h-16 w-auto rounded border border-border object-contain"
            />
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-mono text-foreground">{screenshotName}</span>
              <button
                type="button"
                disabled={busy}
                onClick={clearScreenshot}
                className="w-fit rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {t('feedbackScreenshotRemoveBtn')}
              </button>
            </div>
          </div>
        )}
      </div>

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
    </section>
  );
}
