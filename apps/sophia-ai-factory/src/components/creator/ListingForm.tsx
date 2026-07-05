/**
 * ListingForm — create/edit form for SOP marketplace listings.
 *
 * Client component using useActionState to call createSopListing() or
 * updateSopListing() based on the mode prop. Accepts optional onSuccess
 * and onCancel callbacks for parent-driven navigation.
 *
 * @module components/creator/ListingForm
 */

'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSopListing, updateSopListing } from '@/land/sop-marketplace';

type ListingFormState = (
  | { ok: true; value: { listingId: string } }
  | { ok: false; error: { code: string; message: string } }
) | null;

export interface ListingFormInitialData {
  id?: string;
  title: string;
  description?: string;
  priceCents: number;
  category?: string;
  sopTemplateId: string;
  thumbnailUrl?: string;
}

interface ListingFormProps {
  initialData?: ListingFormInitialData;
  mode: 'create' | 'edit';
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CATEGORIES = [
  'YouTube',
  'TikTok',
  'Facebook',
  'Instagram',
  'Script',
  'Voiceover',
  'Other',
] as const;

export function ListingForm({
  initialData,
  mode,
  onSuccess,
  onCancel,
}: ListingFormProps) {
  const t = useTranslations('marketplace.creator');
  const router = useRouter();

  const [state, formAction, isPending] = useActionState<ListingFormState, FormData>(
    async (_prev, formData) => {
      const title = formData.get('title') as string;
      const description = (formData.get('description') as string) || undefined;
      const priceDollars = parseFloat(formData.get('price') as string);
      const category = (formData.get('category') as string) || undefined;
      const sopTemplateId = formData.get('sopTemplateId') as string;
      const thumbnailUrl =
        (formData.get('thumbnailUrl') as string) || undefined;

      if (!title || !sopTemplateId || isNaN(priceDollars) || priceDollars < 0) {
        return {
          ok: false as const,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Required fields missing',
          },
        };
      }

      const priceCents = Math.round(priceDollars * 100);

      if (mode === 'create') {
        return createSopListing({
          title,
          description,
          priceCents,
          category,
          sopTemplateId,
          thumbnailUrl,
        });
      }

      return updateSopListing(initialData!.id!, {
        title,
        description,
        priceCents,
        category,
        thumbnailUrl,
      });
    },
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      if (onSuccess) {
        onSuccess();
      } else {
        const timer = setTimeout(() => router.refresh(), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [state, onSuccess, router]);

  const defaultPrice =
    initialData !== undefined
      ? (initialData.priceCents / 100).toFixed(2)
      : '';

  return (
    <form action={formAction} className="space-y-5">
      {state?.ok && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-400">
          {t('profileSaved')}
        </div>
      )}
      {state?.ok === false && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {state.error.message}
        </div>
      )}

      {/* Title */}
      <div>
        <label
          htmlFor="title"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('title')}
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={initialData?.title}
          placeholder={t('titlePlaceholder')}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('bio')}
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initialData?.description}
          placeholder={t('bioPlaceholder')}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Price (display as dollars, store as cents) */}
      <div>
        <label
          htmlFor="price"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('price')}
        </label>
        <input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={defaultPrice}
          placeholder={t('pricePlaceholder')}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Category */}
      <div>
        <label
          htmlFor="category"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('category')}
        </label>
        <select
          id="category"
          name="category"
          defaultValue={initialData?.category}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{t('categoryPlaceholder')}</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* SOP Template ID */}
      <div>
        <label
          htmlFor="sopTemplateId"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('sopTemplate')}
        </label>
        <input
          id="sopTemplateId"
          name="sopTemplateId"
          type="text"
          required
          defaultValue={initialData?.sopTemplateId}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Thumbnail URL */}
      <div>
        <label
          htmlFor="thumbnailUrl"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('thumbnail')}
        </label>
        <input
          id="thumbnailUrl"
          name="thumbnailUrl"
          type="text"
          defaultValue={initialData?.thumbnailUrl}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ...
            </span>
          ) : (
            t('save')
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t('cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
