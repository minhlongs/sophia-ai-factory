'use client';

/**
 * Steps 2 & 3 — Select Vertical (Crypto / SaaS) & Add Customer Affiliate Offer.
 *
 * Customer enters their own approved referral link, official product website,
 * commission terms, target audience/market, and product info source.
 * Sophia does NOT require its own partnership when the customer has a valid referral link.
 *
 * @module components/first-value/affiliate-studio/affiliate-offers-card
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AffiliateStudioVertical } from '@/seed/ai/affiliate-campaign-prompt';
import type { PilotAffiliateOfferRecord } from '@/tree/first-value/pilot-affiliate-studio-repo';

export interface NewAffiliateOfferInput {
  readonly vertical: AffiliateStudioVertical;
  readonly productName: string;
  readonly officialWebsiteUrl: string;
  readonly referralUrl: string;
  readonly commissionTerms: string;
  readonly targetAudience: string;
  readonly targetMarket: string;
  readonly productInfoSource: string;
}

export interface AffiliateOffersCardProps {
  readonly offers: readonly PilotAffiliateOfferRecord[];
  readonly selectedOfferId: string | null;
  readonly busy: boolean;
  readonly onSelectOffer: (offerId: string) => void;
  readonly onSaveOffer: (input: NewAffiliateOfferInput) => Promise<boolean>;
  readonly onArchiveOffer: (offerId: string) => Promise<boolean>;
}

const CRYPTO_MARKETS = ['US', 'EU', 'JP', 'VN', 'SG'] as const;
const SAAS_MARKETS = ['GLOBAL', 'US', 'EU', 'VN', 'SG', 'JP'] as const;

export function AffiliateOffersCard({
  offers,
  selectedOfferId,
  busy,
  onSelectOffer,
  onSaveOffer,
  onArchiveOffer,
}: AffiliateOffersCardProps) {
  const t = useTranslations('firstValue');
  const [vertical, setVertical] = useState<AffiliateStudioVertical>('saas');
  const [productName, setProductName] = useState('');
  const [officialWebsiteUrl, setOfficialWebsiteUrl] = useState('');
  const [referralUrl, setReferralUrl] = useState('');
  const [commissionTerms, setCommissionTerms] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [targetMarket, setTargetMarket] = useState('GLOBAL');
  const [productInfoSource, setProductInfoSource] = useState('');

  const canSave =
    productName.trim().length >= 2 &&
    officialWebsiteUrl.trim().startsWith('http') &&
    referralUrl.trim().startsWith('http') &&
    commissionTerms.trim().length >= 3 &&
    targetAudience.trim().length >= 3 &&
    productInfoSource.trim().length >= 3;

  function switchVertical(next: AffiliateStudioVertical) {
    setVertical(next);
    if (next === 'crypto' && targetMarket === 'GLOBAL') {
      setTargetMarket('US');
    }
  }

  async function handleSubmit() {
    if (!canSave) return;
    const ok = await onSaveOffer({
      vertical,
      productName: productName.trim(),
      officialWebsiteUrl: officialWebsiteUrl.trim(),
      referralUrl: referralUrl.trim(),
      commissionTerms: commissionTerms.trim(),
      targetAudience: targetAudience.trim(),
      targetMarket,
      productInfoSource: productInfoSource.trim(),
    });
    if (ok) {
      setProductName('');
      setOfficialWebsiteUrl('');
      setReferralUrl('');
      setCommissionTerms('');
      setTargetAudience('');
      setProductInfoSource('');
    }
  }

  const markets = vertical === 'crypto' ? CRYPTO_MARKETS : SAAS_MARKETS;

  return (
    <section id="affiliate-offers" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-foreground">{t('affOffersTitle')}</h2>
        <p className="text-xs text-muted-foreground">{t('affOffersSubtitle')}</p>
      </div>

      {/* Step 2: Vertical Selector */}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('affVerticalLabel')}>
        <button
          type="button"
          disabled={busy}
          onClick={() => switchVertical('crypto')}
          className={
            vertical === 'crypto'
              ? 'rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground'
              : 'rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted'
          }
        >
          {t('affVerticalCrypto')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => switchVertical('saas')}
          className={
            vertical === 'saas'
              ? 'rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground'
              : 'rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted'
          }
        >
          {t('affVerticalSaas')}
        </button>
      </div>

      {vertical === 'crypto' && (
        <p className="mb-3 rounded-lg border border-amber-500/40 bg-muted/40 p-2.5 text-xs text-foreground">
          {t('affCryptoComplianceNote')}
        </p>
      )}

      {/* Step 3: Add Affiliate Offer Form */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('affProductNameLabel')}
          <input
            type="text"
            maxLength={160}
            value={productName}
            disabled={busy}
            placeholder={t('affProductNamePlaceholder')}
            onChange={(e) => setProductName(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('affOfficialSiteLabel')}
          <input
            type="url"
            maxLength={1000}
            value={officialWebsiteUrl}
            disabled={busy}
            placeholder="https://example.com"
            onChange={(e) => setOfficialWebsiteUrl(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
          {t('affReferralLinkLabel')}
          <input
            type="url"
            maxLength={1000}
            value={referralUrl}
            disabled={busy}
            placeholder="https://example.com/?via=your-partner-code"
            onChange={(e) => setReferralUrl(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('affCommissionTermsLabel')}
          <input
            type="text"
            maxLength={400}
            value={commissionTerms}
            disabled={busy}
            placeholder={t('affCommissionTermsPlaceholder')}
            onChange={(e) => setCommissionTerms(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('affTargetMarketLabel')}
          <select
            value={targetMarket}
            disabled={busy}
            onChange={(e) => setTargetMarket(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {markets.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('affTargetAudienceLabel')}
          <input
            type="text"
            maxLength={300}
            value={targetAudience}
            disabled={busy}
            placeholder={t('affTargetAudiencePlaceholder')}
            onChange={(e) => setTargetAudience(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('affInfoSourceLabel')}
          <input
            type="text"
            maxLength={500}
            value={productInfoSource}
            disabled={busy}
            placeholder={t('affInfoSourcePlaceholder')}
            onChange={(e) => setProductInfoSource(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div>

      <div className="mt-4">
        <button
          type="button"
          disabled={busy || !canSave}
          onClick={() => void handleSubmit()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t('loading') : t('affSaveOfferBtn')}
        </button>
      </div>

      {offers.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="mb-2 text-xs font-semibold text-foreground">{t('affSavedOffersTitle')}</h3>
          <ul className="flex flex-col gap-2">
            {offers.map((offer) => {
              const active = offer.id === selectedOfferId;
              return (
                <li
                  key={offer.id}
                  className={
                    active
                      ? 'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary bg-primary/5 p-3 text-xs'
                      : 'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs'
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-primary/15 px-2 py-0.5 font-mono font-semibold uppercase text-primary">
                        {offer.vertical} · {offer.targetMarket}
                      </span>
                      <strong className="text-sm text-foreground">{offer.productName}</strong>
                    </div>
                    <p className="mt-1 truncate font-mono text-muted-foreground">
                      {offer.referralUrl}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{offer.commissionTerms}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onSelectOffer(offer.id)}
                      className="rounded-md border border-border bg-background px-3 py-1.5 font-medium text-foreground hover:bg-muted"
                    >
                      {active ? t('affSelectedBadge') : t('affUseOfferBtn')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onArchiveOffer(offer.id)}
                      className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-destructive hover:bg-destructive/20"
                    >
                      {t('affArchiveBtn')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
