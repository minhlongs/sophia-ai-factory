'use client';

/**
 * Step 6 of Customer Pilot Validation:
 * Manual Publish Copy Pack + Honest Real Affiliate Reconciliation Ledger.
 *
 * Strictly separates `SERVER_VERIFIED_CLICK` (edge `/api/r/[code]` 302 counter)
 * from `CUSTOMER_SELF_REPORTED` post URLs, views, conversions, and commissions.
 * Never auto-publishes and never fabricates conversions or commissions.
 *
 * @module components/first-value/first-value-manual-publish-card
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';
import type {
  PilotAffiliateLinkSummary,
  PilotManualPublishSummary,
  PilotMp4ExportSummary,
} from '@/seed/pilot/pilot-access-policy';

export interface FirstValueManualPublishCardProps {
  readonly review: DurableFirstValueReview | null;
  readonly busy: boolean;
  readonly consentAccepted?: boolean;
  readonly affiliateLinks: readonly PilotAffiliateLinkSummary[];
  readonly mp4Exports: readonly PilotMp4ExportSummary[];
  readonly manualPublishes: readonly PilotManualPublishSummary[];
  readonly onRecordManualPublish: (input: {
    readonly artifactId: string | null;
    readonly mp4ExportId: string | null;
    readonly linkId: string | null;
    readonly platform: 'tiktok' | 'youtube_shorts' | 'instagram_reels' | 'facebook_reels' | 'other';
    readonly publishedPostUrl: string;
    readonly reportedViews: number | null;
    readonly reportedConversions: number | null;
    readonly reportedCommissionAmount: number | null;
    readonly reportedCommissionCurrency: 'VND' | 'USD' | 'USDT' | null;
    readonly evidenceNote: string | null;
  }) => Promise<boolean>;
}

export function FirstValueManualPublishCard(props: FirstValueManualPublishCardProps) {
  const t = useTranslations('firstValue');
  const [platform, setPlatform] = useState<
    'tiktok' | 'youtube_shorts' | 'instagram_reels' | 'facebook_reels' | 'other'
  >('tiktok');
  const [publishedPostUrl, setPublishedPostUrl] = useState('');
  const [reportedViews, setReportedViews] = useState('');
  const [reportedConversions, setReportedConversions] = useState('');
  const [reportedCommissionAmount, setReportedCommissionAmount] = useState('');
  const [reportedCommissionCurrency, setReportedCommissionCurrency] = useState<
    'VND' | 'USD' | 'USDT'
  >('VND');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [copiedPack, setCopiedPack] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const activeLink =
    (props.review
      ? props.affiliateLinks.find((l) => l.artifactId === props.review?.artifactId)
      : undefined) ??
    props.affiliateLinks[0] ??
    null;
  const latestMp4 =
    (props.review
      ? props.mp4Exports.find(
          (m) => m.artifactId === props.review?.artifactId && m.status === 'completed',
        )
      : undefined) ??
    props.mp4Exports.find((m) => m.status === 'completed') ??
    null;

  const readyCaptionPack =
    props.review && activeLink
      ? [
          props.review.script.title,
          '',
          props.review.script.scenes[0]?.narration ?? '',
          '',
          `👉 ${activeLink.ctaText}`,
          `🔗 ${activeLink.shortUrl}`,
          '',
          `${activeLink.disclosureTag} #SophiaAIFactory`,
        ].join('\n')
      : null;

  async function handleCopyPack() {
    if (!readyCaptionPack || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(readyCaptionPack);
      setCopiedPack(true);
      setTimeout(() => setCopiedPack(false), 2000);
    } catch {
      // Ignore restricted clipboard contexts
    }
  }

  async function handleSubmit() {
    if (!publishedPostUrl.trim()) return;
    setSavedSuccess(false);
    const viewsNum = reportedViews.trim() !== '' ? Number.parseInt(reportedViews, 10) : null;
    const convNum =
      reportedConversions.trim() !== '' ? Number.parseInt(reportedConversions, 10) : null;
    const commNum =
      reportedCommissionAmount.trim() !== '' ? Number.parseFloat(reportedCommissionAmount) : null;

    const ok = await props.onRecordManualPublish({
      artifactId: props.review?.artifactId ?? null,
      mp4ExportId: latestMp4?.id ?? null,
      linkId: activeLink?.id ?? null,
      platform,
      publishedPostUrl: publishedPostUrl.trim(),
      reportedViews: viewsNum !== null && Number.isFinite(viewsNum) ? viewsNum : null,
      reportedConversions: convNum !== null && Number.isFinite(convNum) ? convNum : null,
      reportedCommissionAmount: commNum !== null && Number.isFinite(commNum) ? commNum : null,
      reportedCommissionCurrency:
        commNum !== null && Number.isFinite(commNum) ? reportedCommissionCurrency : null,
      evidenceNote: evidenceNote.trim() || null,
    });
    if (ok) {
      setPublishedPostUrl('');
      setReportedViews('');
      setReportedConversions('');
      setReportedCommissionAmount('');
      setEvidenceNote('');
      setSavedSuccess(true);
    }
  }

  const totalServerClicks = props.affiliateLinks.reduce(
    (sum, item) => sum + item.verifiedClicks,
    0,
  );

  return (
    <section
      id="pilot-manual-publish"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('pilotPublishTitle')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('pilotPublishSubtitle')}</p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          SERVER_VERIFIED_CLICK: {totalServerClicks}
        </span>
      </div>

      {readyCaptionPack && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              {t('pilotCaptionPackLabel')}
            </span>
            <button
              type="button"
              onClick={() => void handleCopyPack()}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
            >
              {copiedPack ? t('copiedBtn') : t('pilotCopyCaptionPackBtn')}
            </button>
          </div>
          <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-2.5 font-mono text-xs text-foreground">
            {readyCaptionPack}
          </pre>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('pilotPlatformLabel')}
          <select
            value={platform}
            disabled={props.busy}
            onChange={(e) => setPlatform(e.target.value as typeof platform)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground"
          >
            <option value="tiktok">TikTok</option>
            <option value="youtube_shorts">YouTube Shorts</option>
            <option value="instagram_reels">Instagram Reels</option>
            <option value="facebook_reels">Facebook Reels</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('pilotPostUrlLabel')}
          <input
            type="url"
            value={publishedPostUrl}
            disabled={props.busy}
            placeholder="https://www.tiktok.com/@.../video/..."
            onChange={(e) => setPublishedPostUrl(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('pilotReportedViewsLabel')}
          <input
            type="number"
            min={0}
            value={reportedViews}
            disabled={props.busy}
            placeholder="0"
            onChange={(e) => setReportedViews(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('pilotReportedConversionsLabel')}
          <input
            type="number"
            min={0}
            value={reportedConversions}
            disabled={props.busy}
            placeholder={t('pilotLeaveBlankIfNone')}
            onChange={(e) => setReportedConversions(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('pilotReportedCommissionLabel')}
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              step="any"
              value={reportedCommissionAmount}
              disabled={props.busy}
              placeholder={t('pilotLeaveBlankIfNone')}
              onChange={(e) => setReportedCommissionAmount(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
            />
            <select
              value={reportedCommissionCurrency}
              disabled={props.busy}
              onChange={(e) =>
                setReportedCommissionCurrency(e.target.value as 'VND' | 'USD' | 'USDT')
              }
              className="rounded-lg border border-input bg-background px-2 py-2 font-mono text-xs text-foreground"
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('pilotEvidenceNoteLabel')}
          <input
            type="text"
            maxLength={1000}
            value={evidenceNote}
            disabled={props.busy}
            placeholder={t('pilotEvidenceNotePlaceholder')}
            onChange={(e) => setEvidenceNote(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!(props.consentAccepted ?? true) || props.busy || publishedPostUrl.trim().length < 12}
          onClick={() => void handleSubmit()}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {t('pilotSaveManualPublishBtn')}
        </button>
        {savedSuccess && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {t('pilotManualPublishSavedNotice')}
          </span>
        )}
      </div>

      {props.manualPublishes.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="text-xs font-semibold text-foreground">
            {t('pilotManualPublishHistoryTitle')}
          </div>
          {props.manualPublishes.slice(0, 5).map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs"
            >
              <div className="space-y-0.5">
                <a
                  href={entry.publishedPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-medium text-primary underline"
                >
                  [{entry.platform}] {entry.publishedPostUrl.slice(0, 64)}
                </a>
                <div className="font-mono text-muted-foreground">
                  {entry.provenance}
                  {entry.reportedViews != null ? ` • views:${entry.reportedViews}` : ''}
                  {entry.reportedConversions != null
                    ? ` • conversions:${entry.reportedConversions}`
                    : ''}
                  {entry.reportedCommissionAmount != null
                    ? ` • commission:${entry.reportedCommissionAmount} ${entry.reportedCommissionCurrency ?? ''}`
                    : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
