'use client';

/**
 * Invite-only Beta & Privacy Notice + Pilot Terms Consent banner.
 *
 * Rendered when `pilot.liveInferenceEnabled` is active on the pilot environment.
 * Shows funding mode (Customer BYOK vs Founder-Sponsored Free Pilot), remaining
 * generation quota, and a direct anchor link to in-app Support & Data Deletion.
 *
 * @module components/first-value/first-value-pilot-banner
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PilotStatusSnapshot } from '@/seed/pilot/pilot-access-policy';

export interface FirstValuePilotBannerProps {
  readonly pilot: PilotStatusSnapshot;
  readonly busy: boolean;
  readonly onAcceptTerms: () => Promise<void>;
}

export function FirstValuePilotBanner({
  pilot,
  busy,
  onAcceptTerms,
}: FirstValuePilotBannerProps) {
  const t = useTranslations('firstValue');
  const [checked, setChecked] = useState(false);

  const fundingLabel =
    pilot.financingMode === 'CUSTOMER_BYOK' || pilot.fundingMode === 'customer_byok'
      ? t('pilotFundingByok')
      : pilot.fundingMode === 'founder_sponsored'
        ? t('pilotFundingSponsored')
        : t('pilotFundingNone');

  return (
    <section className="rounded-xl border border-primary/40 bg-primary/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-primary/15 px-3 py-1 font-mono text-xs font-semibold text-primary">
          {t('pilotBetaBadge')}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {t('pilotQuotaLabel')}: {pilot.quota.remainingGenerations}/{pilot.quota.maxGenerations}
        </span>
      </div>

      <p className="mt-2 text-sm text-foreground">{t('pilotBetaNotice')}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          <strong>{t('pilotFundingLabel')}:</strong> {fundingLabel}
        </span>
        <a
          href="#support-deletion"
          className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
        >
          {t('supportJumpLink')}
        </a>
      </div>

      {!pilot.consentAccepted ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">{t('pilotPrivacyTitle')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('pilotPrivacySummary')}</p>
          <label className="mt-3 flex items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={busy}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <span>{t('pilotConsentCheckbox')}</span>
          </label>
          <button
            type="button"
            disabled={busy || !checked}
            onClick={() => void onAcceptTerms()}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? t('loading') : t('pilotConsentBtn')}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {t('pilotConsentAccepted')}
        </p>
      )}
    </section>
  );
}
