'use client';

import React from 'react';

export interface CreatorOnboardingFieldsProps {
  t: (key: string) => string;
}

const INPUT_CLASS =
  'block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const LABEL_CLASS = 'mb-1 block text-sm font-medium text-foreground';

export function CreatorOnboardingFields({ t }: CreatorOnboardingFieldsProps) {
  return (
    <>
      {/* Display Name */}
      <div>
        <label htmlFor="displayName" className={LABEL_CLASS}>
          {t('displayName')}
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          placeholder={t('displayNamePlaceholder')}
          className={INPUT_CLASS}
        />
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className={LABEL_CLASS}>
          {t('bio')}
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          placeholder={t('bioPlaceholder')}
          className={INPUT_CLASS}
        />
      </div>

      {/* Payout Method */}
      <div>
        <label htmlFor="payoutMethod" className={LABEL_CLASS}>
          {t('payoutMethod')}
        </label>
        <select
          id="payoutMethod"
          name="payoutMethod"
          required
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
        <label htmlFor="payoutAddress" className={LABEL_CLASS}>
          {t('payoutAddress')}
        </label>
        <input
          id="payoutAddress"
          name="payoutAddress"
          type="text"
          required
          placeholder={t('payoutAddressPlaceholder')}
          className={INPUT_CLASS}
        />
      </div>

      {/* Invite Code */}
      <div>
        <label htmlFor="inviteCode" className={LABEL_CLASS}>
          {t('inviteCode')}
        </label>
        <input
          id="inviteCode"
          name="inviteCode"
          type="text"
          placeholder={t('inviteCodePlaceholder')}
          className={INPUT_CLASS}
        />
      </div>
    </>
  );
}
