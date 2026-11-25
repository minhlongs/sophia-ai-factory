'use client';

/**
 * Step 5 of Customer Pilot Validation:
 * - Attach CTA + Verified Affiliate Destination URL -> mint live `/api/r/[code]` shortlink
 * - Export real H.264/AVC1 `.mp4` (1-Key Browser MP4 default + Optional HeyGen BYOK Avatar MP4)
 *
 * @module components/first-value/first-value-mp4-affiliate-card
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';
import type {
  PilotAffiliateLinkSummary,
  PilotMp4ExportSummary,
} from '@/seed/pilot/pilot-access-policy';
import { renderAndDownloadPilotMp4 } from './pilot-browser-mp4-renderer';
import { PilotVoiceAndCapCutPack } from './pilot-voice-and-capcut-pack';

export interface FirstValueMp4AffiliateCardProps {
  readonly review: DurableFirstValueReview | null;
  readonly busy: boolean;
  readonly consentAccepted?: boolean;
  readonly defaultDestinationUrl?: string;
  readonly defaultCtaText?: string;
  readonly heygenConfigured: boolean;
  readonly affiliateLinks: readonly PilotAffiliateLinkSummary[];
  readonly mp4Exports: readonly PilotMp4ExportSummary[];
  readonly onCreateShortlink: (input: {
    readonly destinationUrl: string;
    readonly ctaText: string;
    readonly networkHint:
      | 'generic'
      | 'shopee'
      | 'tiktok_shop'
      | 'accesstrade'
      | 'clickbank'
      | 'amazon'
      | 'awin';
    readonly disclosureTag: '#QuảngCáo' | '#ad';
  }) => Promise<PilotAffiliateLinkSummary | null>;
  readonly onRecordBrowserMp4: (input: {
    readonly artifactId: string;
    readonly sha256Hex: string;
    readonly byteSize: number;
    readonly durationSec: number;
    readonly width: number;
    readonly height: number;
    readonly ctaText: string;
    readonly shortCode: string;
    readonly referralUrl: string;
  }) => Promise<boolean>;
  readonly onSaveHeyGenKey: (apiKey: string) => Promise<boolean>;
  readonly onClearHeyGenKey: () => Promise<boolean>;
  readonly onSubmitHeyGenMp4: (input: {
    readonly artifactId: string;
    readonly ctaText: string;
    readonly shortCode: string;
    readonly referralUrl: string;
  }) => Promise<boolean>;
  readonly onPollHeyGenMp4: (exportId: string) => Promise<void>;
}

export function FirstValueMp4AffiliateCard(props: FirstValueMp4AffiliateCardProps) {
  const t = useTranslations('firstValue');
  const [destinationUrl, setDestinationUrl] = useState(props.defaultDestinationUrl ?? '');
  const [ctaText, setCtaText] = useState(props.defaultCtaText ?? '');
  const [networkHint, setNetworkHint] = useState<
    'generic' | 'shopee' | 'tiktok_shop' | 'accesstrade' | 'clickbank' | 'amazon' | 'awin'
  >('generic');
  const [disclosureTag, setDisclosureTag] = useState<'#QuảngCáo' | '#ad'>('#QuảngCáo');
  const [heygenKeyInput, setHeygenKeyInput] = useState('');
  const [renderingMp4, setRenderingMp4] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [productImageUrls, setProductImageUrls] = useState<readonly string[]>([]);
  const productImageUrlsRef = useRef<readonly string[]>([]);
  productImageUrlsRef.current = productImageUrls;

  useEffect(() => {
    return () => {
      if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
      for (const url of productImageUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    if (props.defaultDestinationUrl) {
      setDestinationUrl((prev) => (prev.trim() ? prev : props.defaultDestinationUrl ?? ''));
    }
  }, [props.defaultDestinationUrl]);

  useEffect(() => {
    if (props.defaultCtaText) {
      setCtaText((prev) => (prev.trim() ? prev : props.defaultCtaText ?? ''));
    }
  }, [props.defaultCtaText]);

  const activeLink =
    (props.review
      ? props.affiliateLinks.find((l) => l.artifactId === props.review?.artifactId)
      : undefined) ??
    props.affiliateLinks[0] ??
    null;
  const consentOk = props.consentAccepted ?? true;
  const isAccepted = props.review?.reviewState === 'accepted';
  const canAutoCreateLink = destinationUrl.trim().length >= 10 && ctaText.trim().length >= 3;
  const canRenderMp4 = Boolean(isAccepted && (activeLink || canAutoCreateLink));

  async function ensureActiveLink(): Promise<PilotAffiliateLinkSummary | null> {
    if (activeLink) return activeLink;
    if (!canAutoCreateLink) return null;
    return props.onCreateShortlink({
      destinationUrl: destinationUrl.trim(),
      ctaText: ctaText.trim(),
      networkHint,
      disclosureTag,
    });
  }

  async function handleCreateLink() {
    if (!destinationUrl.trim() || !ctaText.trim()) return;
    await props.onCreateShortlink({
      destinationUrl: destinationUrl.trim(),
      ctaText: ctaText.trim(),
      networkHint,
      disclosureTag,
    });
  }

  async function handleBrowserMp4Export() {
    if (!props.review || !isAccepted) return;
    setRenderingMp4(true);
    try {
      const resolvedLink = await ensureActiveLink();
      if (!resolvedLink) return;
      const encoded = await renderAndDownloadPilotMp4({
        artifactId: props.review.artifactId,
        script: props.review.script,
        ctaText: resolvedLink.ctaText,
        shortUrl: resolvedLink.shortUrl,
        disclosureTag: resolvedLink.disclosureTag,
        productImageUrls,
      });
      await props.onRecordBrowserMp4({
        artifactId: props.review.artifactId,
        sha256Hex: encoded.sha256Hex,
        byteSize: encoded.byteSize,
        durationSec: encoded.durationSec,
        width: encoded.width,
        height: encoded.height,
        ctaText: resolvedLink.ctaText,
        shortCode: resolvedLink.shortCode,
        referralUrl: resolvedLink.shortUrl,
      });
    } finally {
      setRenderingMp4(false);
    }
  }

  async function handleHeyGenMp4Submit() {
    if (!props.review || !isAccepted) return;
    setRenderingMp4(true);
    try {
      const resolvedLink = await ensureActiveLink();
      if (!resolvedLink) return;
      await props.onSubmitHeyGenMp4({
        artifactId: props.review.artifactId,
        ctaText: resolvedLink.ctaText,
        shortCode: resolvedLink.shortCode,
        referralUrl: resolvedLink.shortUrl,
      });
    } finally {
      setRenderingMp4(false);
    }
  }

  async function copyShortUrl(shortUrl: string, code: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Ignore clipboard failure in restricted iframe/browser contexts
    }
  }

  return (
    <section
      id="pilot-mp4-affiliate"
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5"
    >
      <div>
        <h2 className="text-base font-semibold text-foreground">{t('pilotMp4Title')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('pilotMp4Subtitle')}</p>
      </div>

      {/* Step A: CTA & Affiliate Shortlink */}
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">
          {t('pilotShortlinkHeading')}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('pilotAffiliateDestLabel')}
            <input
              type="url"
              value={destinationUrl}
              placeholder="https://..."
              disabled={props.busy}
              onChange={(e) => setDestinationUrl(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('pilotCtaInputLabel')}
            <input
              type="text"
              maxLength={240}
              value={ctaText}
              placeholder={t('pilotCtaPlaceholder')}
              disabled={props.busy}
              onChange={(e) => setCtaText(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('pilotNetworkLabel')}
            <select
              value={networkHint}
              disabled={props.busy}
              onChange={(e) =>
                setNetworkHint(e.target.value as typeof networkHint)
              }
              className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground"
            >
              <option value="generic">Generic / SaaS (sub_id)</option>
              <option value="shopee">Shopee Affiliate (utm_content)</option>
              <option value="tiktok_shop">TikTok Shop (aff_sub)</option>
              <option value="accesstrade">AccessTrade (utm_content)</option>
              <option value="clickbank">ClickBank (tid)</option>
              <option value="amazon">Amazon Associates (tag)</option>
              <option value="awin">Awin (clickref)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('pilotDisclosureLabel')}
            <select
              value={disclosureTag}
              disabled={props.busy}
              onChange={(e) => setDisclosureTag(e.target.value as '#QuảngCáo' | '#ad')}
              className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground"
            >
              <option value="#QuảngCáo">#QuảngCáo (VN)</option>
              <option value="#ad">#ad (Global/FTC)</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={
              !consentOk ||
              props.busy ||
              destinationUrl.trim().length < 10 ||
              ctaText.trim().length < 3
            }
            onClick={() => void handleCreateLink()}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {t('pilotCreateShortlinkBtn')}
          </button>
        </div>

        {activeLink && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-background p-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-mono font-semibold text-foreground">{activeLink.shortUrl}</div>
              <div className="text-muted-foreground">
                CTA: {activeLink.ctaText} • {activeLink.disclosureTag} •{' '}
                <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                  {t('pilotVerifiedClicksLabel')}: {activeLink.verifiedClicks}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void copyShortUrl(activeLink.shortUrl, activeLink.shortCode)}
              className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:opacity-90"
            >
              {copiedCode === activeLink.shortCode ? t('copiedBtn') : t('copyExportBtn')}
            </button>
          </div>
        )}
      </div>

      {/* Step B: 1-Key Browser MP4 Export + Optional HeyGen BYOK */}
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
          {t('pilotRenderMp4Heading')}
        </h3>
        {!canRenderMp4 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">{t('pilotMp4Prerequisite')}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              data-testid="pilot-export-browser-mp4-btn"
              disabled={!consentOk || props.busy || renderingMp4}
              onClick={() => void handleBrowserMp4Export()}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {renderingMp4 ? t('loading') : t('pilotExportBrowserMp4Btn')}
            </button>

            {props.heygenConfigured && props.review && (
              <button
                type="button"
                disabled={!consentOk || props.busy || renderingMp4}
                onClick={() => void handleHeyGenMp4Submit()}
                className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
              >
                {t('pilotSubmitHeyGenMp4Btn')}
              </button>
            )}
          </div>
        )}

        {props.review && isAccepted && (
          <div className="mt-4">
            <PilotVoiceAndCapCutPack
              artifactId={props.review.artifactId}
              script={props.review.script}
              ctaText={activeLink?.ctaText ?? ctaText}
              shortUrl={activeLink?.shortUrl ?? destinationUrl}
              disclosureTag={activeLink?.disclosureTag ?? disclosureTag}
              busy={props.busy || renderingMp4}
              productImageUrls={productImageUrls}
              onProductImagesChange={setProductImageUrls}
            />
          </div>
        )}

        {/* Optional HeyGen BYOK Drawer */}
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-muted-foreground">{t('pilotHeyGenOptionalLabel')}</span>
            {props.heygenConfigured ? (
              <button
                type="button"
                disabled={props.busy}
                onClick={() => void props.onClearHeyGenKey()}
                className="text-xs font-medium text-destructive underline"
              >
                {t('pilotByokClearBtn')} (HeyGen)
              </button>
            ) : null}
          </div>
          {!props.heygenConfigured && (
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="password"
                autoComplete="off"
                value={heygenKeyInput}
                disabled={props.busy}
                placeholder={t('pilotHeyGenKeyPlaceholder')}
                onChange={(e) => setHeygenKeyInput(e.target.value)}
                className="min-w-[240px] flex-1 rounded-lg border border-input bg-background px-3 py-1.5 font-mono text-xs text-foreground"
              />
              <button
                type="button"
                disabled={!consentOk || props.busy || heygenKeyInput.trim().length < 16}
                onClick={async () => {
                  const ok = await props.onSaveHeyGenKey(heygenKeyInput.trim());
                  if (ok) setHeygenKeyInput('');
                }}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {t('pilotSaveHeyGenBtn')}
              </button>
            </div>
          )}
        </div>

        {/* Recorded MP4 Export Proofs */}
        {props.mp4Exports.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-semibold text-foreground">{t('pilotMp4ReceiptsTitle')}</div>
            {props.mp4Exports.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-2.5 text-xs"
              >
                <div className="font-mono text-foreground">
                  {item.renderMode} • {item.status.toUpperCase()}
                  {item.durationSec ? ` • ${item.durationSec}s` : ''}
                  {item.byteSize ? ` • ${(item.byteSize / 1024).toFixed(1)} KB` : ''}
                  {item.sha256Hex ? ` • sha256:${item.sha256Hex.slice(0, 12)}…` : ''}
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'processing' && (
                    <button
                      type="button"
                      disabled={props.busy}
                      onClick={() => void props.onPollHeyGenMp4(item.id)}
                      className="rounded border border-border px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      {t('pilotPollHeyGenBtn')}
                    </button>
                  )}
                  {item.providerVideoUrl && (
                    <a
                      href={item.providerVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                    >
                      {t('downloadExportBtn')} MP4
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
