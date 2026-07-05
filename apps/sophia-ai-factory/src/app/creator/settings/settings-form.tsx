/**
 * CreatorSettingsForm — client component for editing creator profile settings.
 *
 * Pre-fills fields from existing profile data and uses updateCreatorProfile()
 * server action to save changes.
 *
 * @module app/creator/settings/settings-form
 */

'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { updateCreatorProfile } from '@/land/sop-marketplace';
import type { CreatorProfileView } from '@/land/sop-marketplace';

type FormState = (
  | { ok: true; value: { profileId: string } }
  | { ok: false; error: { code: string; message: string } }
) | null;

function initialState(profile: CreatorProfileView) {
  return {
    displayName: profile.displayName,
    bio: profile.bio ?? '',
    payoutMethod: profile.payoutMethod ?? '',
    payoutAddress: profile.payoutAddress ?? '',
  };
}

export default function CreatorSettingsForm({
  profile,
}: {
  profile: CreatorProfileView;
}) {
  const t = useTranslations('marketplace.creator');

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const displayName = formData.get('displayName') as string;
      const bio = (formData.get('bio') as string) || undefined;
      const payoutMethodRaw = formData.get('payoutMethod') as string;
      const payoutAddress = (formData.get('payoutAddress') as string) || undefined;

      // Only send payoutMethod if a value was selected (not the empty placeholder)
      const payoutMethod = payoutMethodRaw
        ? (payoutMethodRaw as 'nowpayments' | 'stripe_connect' | 'usdt')
        : undefined;

      return updateCreatorProfile({
        displayName: displayName || undefined,
        bio,
        payoutMethod,
        payoutAddress,
      });
    },
    null,
  );

  const init = initialState(profile);

  return (
    <form action={formAction} className="space-y-5">
      {state?.ok && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-400">
          {t('settingsSaved')}
        </div>
      )}
      {state?.ok === false && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {state.error.message}
        </div>
      )}

      {/* Display Name */}
      <div>
        <label
          htmlFor="displayName"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('displayName')}
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          defaultValue={init.displayName}
          placeholder={t('displayNamePlaceholder')}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Bio */}
      <div>
        <label
          htmlFor="bio"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('bio')}
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={init.bio}
          placeholder={t('bioPlaceholder')}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Payout Method */}
      <div>
        <label
          htmlFor="payoutMethod"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('payoutMethod')}
        </label>
        <select
          id="payoutMethod"
          name="payoutMethod"
          defaultValue={init.payoutMethod}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{t('payoutMethodPlaceholder')}</option>
          <option value="nowpayments">NOWPayments</option>
          <option value="stripe_connect">Stripe Connect</option>
          <option value="usdt">USDT</option>
        </select>
      </div>

      {/* Payout Address */}
      <div>
        <label
          htmlFor="payoutAddress"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          {t('payoutAddress')}
        </label>
        <input
          id="payoutAddress"
          name="payoutAddress"
          type="text"
          defaultValue={init.payoutAddress}
          placeholder={t('payoutAddressPlaceholder')}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Submit */}
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
    </form>
  );
}
