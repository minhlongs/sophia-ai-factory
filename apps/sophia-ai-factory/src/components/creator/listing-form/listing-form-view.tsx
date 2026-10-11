'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSopListing, updateSopListing } from '@/land/sop-marketplace';
import type { ListingFormProps, ListingFormState } from './types';
import { FormFields } from './form-fields';
import { PricingTierFields } from './pricing-tier-fields';

export function ListingFormView({
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

      <FormFields initialData={initialData} t={t} />
      <PricingTierFields initialData={initialData} t={t} />

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
