'use client';

import { useTranslations } from 'next-intl';

export interface CreatorSettingsInitValues {
  displayName: string;
  bio: string;
  payoutMethod: string;
  payoutAddress: string;
}

export function CreatorSettingsFields({
  init,
}: {
  init: CreatorSettingsInitValues;
}) {
  const t = useTranslations('marketplace.creator');

  const inputClass =
    'block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <>
      <div>
        <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-foreground">
          {t('displayName')}
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          defaultValue={init.displayName}
          placeholder={t('displayNamePlaceholder')}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="bio" className="mb-1 block text-sm font-medium text-foreground">
          {t('bio')}
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={init.bio}
          placeholder={t('bioPlaceholder')}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="payoutMethod" className="mb-1 block text-sm font-medium text-foreground">
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

      <div>
        <label htmlFor="payoutAddress" className="mb-1 block text-sm font-medium text-foreground">
          {t('payoutAddress')}
        </label>
        <input
          id="payoutAddress"
          name="payoutAddress"
          type="text"
          defaultValue={init.payoutAddress}
          placeholder={t('payoutAddressPlaceholder')}
          className={inputClass}
        />
      </div>
    </>
  );
}
