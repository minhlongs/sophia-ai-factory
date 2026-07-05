'use client';

/**
 * ReviewForm — star rating + optional written review for an installed SOP.
 *
 * Fields:
 *  - Rating: 1-5 clickable star selector (hover effects)
 *  - Review text: optional textarea
 *
 * On submit, calls a minimal inline server action that writes to the DB.
 */

import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ReviewFormProps {
  installId: string;
  listingId: string;
  onSuccess?: () => void;
}

/** State for the review form action */
type ReviewState = { ok: true } | { ok: false; error: string } | null;

export function ReviewForm({ installId, listingId, onSuccess }: ReviewFormProps) {
  const t = useTranslations('marketplace.creator');
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const [state, formAction, isPending] = useActionState<ReviewState, FormData>(
    async (_prev, formData) => {
      const review = (formData.get('review') as string) || '';
      const stars = parseInt(formData.get('rating') as string, 10);

      if (stars < 1 || stars > 5) {
        return { ok: false, error: 'Rating must be between 1 and 5' };
      }

      try {
        const base = process.env.NEXT_PUBLIC_APP_URL || '';
        const res = await fetch(`${base}/api/sop-marketplace/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ installId, listingId, rating: stars, review }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          return { ok: false, error: body?.error ?? 'Failed to submit review' };
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
      }
    },
    null,
  );

  // Navigate on success — must use effect, not render
  useEffect(() => {
    if (state?.ok) {
      if (onSuccess) onSuccess();
      router.refresh();
    }
  }, [state, onSuccess, router]);

  const starLabels = ['', t('yourRating'), '2', '3', '4', '5'];

  return (
    <form action={formAction} className="space-y-3">
      {/* Star rating */}
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {t('yourRating')}
        </p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={starLabels[star]}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="text-lg transition-colors focus:outline-none"
            >
              <span
                className={
                  star <= (hoverRating || rating)
                    ? 'text-yellow-500'
                    : 'text-muted-foreground/30'
                }
              >
                &#9733;
              </span>
            </button>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating} />
      </div>

      {/* Review textarea */}
      <div>
        <textarea
          name="review"
          rows={3}
          placeholder={t('reviewPlaceholder')}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={rating < 1 || isPending}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {t('submitReview')}...
          </>
        ) : (
          t('submitReview')
        )}
      </button>

      {/* Error display */}
      {state && !state.ok && 'error' in state && (
        <p className="text-xs text-destructive" role="alert">
          {(state as { ok: false; error: string }).error}
        </p>
      )}

      {/* Success display */}
      {state?.ok && (
        <p className="text-xs text-green-500">
          {t('submitReview')} &#10003;
        </p>
      )}
    </form>
  );
}
