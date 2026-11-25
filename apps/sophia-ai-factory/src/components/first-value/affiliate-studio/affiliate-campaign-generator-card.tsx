'use client';

/**
 * Step 4 — AI Affiliate Campaign Generator & Campaign List (`#campaigns`).
 *
 * Generates a full Affiliate Campaign Pack (audience analysis, value prop, angles,
 * short-form script, hook, CTA, social post, disclosure, exact referral link)
 * using the customer's BYOK OpenRouter key.
 *
 * @module components/first-value/affiliate-studio/affiliate-campaign-generator-card
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  PilotAffiliateCampaignRecord,
  PilotAffiliateOfferRecord,
} from '@/tree/first-value/pilot-affiliate-studio-repo';

export type CampaignContentLocale = 'en' | 'vi';

export function resolveDefaultContentLocaleForMarket(
  targetMarket: string | null | undefined,
): CampaignContentLocale {
  return (targetMarket ?? '').trim().toUpperCase() === 'VN' ? 'vi' : 'en';
}

export interface AffiliateCampaignGeneratorCardProps {
  readonly selectedOffer: PilotAffiliateOfferRecord | null;
  readonly campaigns: readonly PilotAffiliateCampaignRecord[];
  readonly activeCampaignId: string | null;
  readonly modelId: string;
  readonly canGenerate: boolean;
  readonly busy: boolean;
  readonly onSelectCampaign: (campaignId: string) => void;
  readonly onGenerate: (durationSec: number, contentLocale: CampaignContentLocale) => Promise<void>;
}

export function AffiliateCampaignGeneratorCard({
  selectedOffer,
  campaigns,
  activeCampaignId,
  modelId,
  canGenerate,
  busy,
  onSelectCampaign,
  onGenerate,
}: AffiliateCampaignGeneratorCardProps) {
  const t = useTranslations('firstValue');
  const [durationSec, setDurationSec] = useState(30);
  const defaultLocale = resolveDefaultContentLocaleForMarket(selectedOffer?.targetMarket);
  const [contentLocale, setContentLocale] = useState<CampaignContentLocale>(defaultLocale);

  useEffect(() => {
    setContentLocale(resolveDefaultContentLocaleForMarket(selectedOffer?.targetMarket));
  }, [selectedOffer?.id, selectedOffer?.targetMarket]);

  return (
    <section id="campaigns" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('affCampaignGenTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('affCampaignGenSubtitle')}</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
          {modelId}
        </span>
      </div>

      {!selectedOffer ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          {t('affSelectOfferFirst')}
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="text-xs">
            <span className="font-semibold text-foreground">{selectedOffer.productName}</span>
            <span className="ml-2 font-mono text-muted-foreground">
              ({selectedOffer.vertical.toUpperCase()} · {selectedOffer.targetMarket})
            </span>
            <div className="mt-1 truncate font-mono text-primary">{selectedOffer.referralUrl}</div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t('durationLabel')}
              <input
                type="number"
                min={15}
                max={180}
                value={durationSec}
                disabled={busy}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t('affContentLangLabel')}
              <select
                value={contentLocale}
                disabled={busy}
                onChange={(e) => setContentLocale(e.target.value as CampaignContentLocale)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="en">{t('affContentLangEn')}</option>
                <option value="vi">{t('affContentLangVi')}</option>
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !canGenerate}
              onClick={() => void onGenerate(durationSec, contentLocale)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t('loading') : t('affGenerateCampaignBtn')}
            </button>
          </div>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="mb-2 text-xs font-semibold text-foreground">{t('affCampaignListTitle')}</h3>
          <ul className="flex flex-col gap-2">
            {campaigns.map((camp) => {
              const active = camp.id === activeCampaignId;
              return (
                <li
                  key={camp.id}
                  className={
                    active
                      ? 'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary bg-primary/5 p-3 text-xs'
                      : 'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs'
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground">{camp.campaignName}</div>
                    <div className="mt-0.5 font-mono text-muted-foreground">
                      v{camp.version} · {camp.reviewState} · {camp.provenanceLabel}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSelectCampaign(camp.id)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 font-medium text-foreground hover:bg-muted"
                  >
                    {active ? t('affSelectedBadge') : t('affOpenWorkspaceBtn')}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
