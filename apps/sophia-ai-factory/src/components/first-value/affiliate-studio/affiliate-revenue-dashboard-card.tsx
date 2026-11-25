'use client';

/**
 * Step 6 — Revenue Analytics & Partner Performance Ledger (`#revenue-analytics`).
 *
 * Displays real Domain B reconciliation figures (`workspace_external_commissions`),
 * `NOT_CONNECTED` status when partner postback webhooks are not configured, and
 * allows recording verified partner statement reports with explicit source provenance.
 * Zero fabricated integrations or fake clicks/commissions.
 *
 * @module components/first-value/affiliate-studio/affiliate-revenue-dashboard-card
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  currencySubunitScale,
  formatAffiliateCurrencyAmount,
  type AffiliateRevenueSnapshot,
} from '@/land/first-value/pilot-affiliate-studio-revenue';
import type {
  PilotAffiliateCampaignRecord,
  PilotAffiliatePerformanceEntry,
} from '@/tree/first-value/pilot-affiliate-studio-repo';

export interface RecordPerformanceFormInput {
  readonly campaignId: string;
  readonly reportSource: string;
  readonly reportPeriod: string;
  readonly externalRefId: string;
  readonly clicksCount: number | null;
  readonly signupsCount: number;
  readonly qualifiedConversions: number;
  readonly pendingCommissionUsd: number;
  readonly confirmedCommissionUsd: number;
  readonly currency: 'USD' | 'USDT' | 'EUR' | 'VND';
}

export interface AffiliateRevenueDashboardCardProps {
  readonly revenue: AffiliateRevenueSnapshot;
  readonly campaigns: readonly PilotAffiliateCampaignRecord[];
  readonly entries: readonly PilotAffiliatePerformanceEntry[];
  readonly busy: boolean;
  readonly onRecordPerformance: (input: RecordPerformanceFormInput) => Promise<boolean>;
}

export function AffiliateRevenueDashboardCard({
  revenue,
  campaigns,
  entries,
  busy,
  onRecordPerformance,
}: AffiliateRevenueDashboardCardProps) {
  const t = useTranslations('firstValue');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [reportSource, setReportSource] = useState('');
  const [reportPeriod, setReportPeriod] = useState('');
  const [externalRefId, setExternalRefId] = useState('');
  const [clicksRaw, setClicksRaw] = useState('');
  const [signupsCount, setSignupsCount] = useState(0);
  const [qualifiedConversions, setQualifiedConversions] = useState(0);
  const [pendingCommissionUsd, setPendingCommissionUsd] = useState(0);
  const [confirmedCommissionUsd, setConfirmedCommissionUsd] = useState(0);
  const [currency, setCurrency] = useState<'USD' | 'USDT' | 'EUR' | 'VND'>('USD');
  const [savedNotice, setSavedNotice] = useState(false);

  const selectedCampaignId = campaignId || campaigns[0]?.id || '';
  const canRecord =
    Boolean(selectedCampaignId) &&
    reportSource.trim().length >= 3 &&
    reportPeriod.trim().length >= 2 &&
    externalRefId.trim().length >= 3;

  async function handleSubmit() {
    if (!canRecord) return;
    setSavedNotice(false);
    const parsedClicks = clicksRaw.trim() === '' ? null : Math.max(0, Number.parseInt(clicksRaw, 10) || 0);
    const ok = await onRecordPerformance({
      campaignId: selectedCampaignId,
      reportSource: reportSource.trim(),
      reportPeriod: reportPeriod.trim(),
      externalRefId: externalRefId.trim(),
      clicksCount: parsedClicks,
      signupsCount,
      qualifiedConversions,
      pendingCommissionUsd,
      confirmedCommissionUsd,
      currency,
    });
    if (ok) {
      setExternalRefId('');
      setClicksRaw('');
      setSignupsCount(0);
      setQualifiedConversions(0);
      setPendingCommissionUsd(0);
      setConfirmedCommissionUsd(0);
      setSavedNotice(true);
    }
  }

  const fmtCommission = (val: number | null) =>
    formatAffiliateCurrencyAmount(val, revenue.currency, {
      unavailableLabel: t('affMultiCurrencyBadge'),
    });

  const fmtNetRevenue = () => {
    if (revenue.netRevenueUsd !== null) {
      return formatAffiliateCurrencyAmount(revenue.netRevenueUsd, 'USD');
    }
    if (
      revenue.netRevenueUnavailableReason === 'NON_USD_COMMISSION' &&
      revenue.confirmedCommissionUsd !== null
    ) {
      return `${formatAffiliateCurrencyAmount(revenue.confirmedCommissionUsd, revenue.currency)} (− $${revenue.estimatedAiCostUsd.toFixed(2)} AI)`;
    }
    return t('affMultiCurrencyBadge');
  };

  return (
    <section id="revenue-analytics" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('affRevenueTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('affRevenueSubtitle')}</p>
        </div>
        <span className="rounded-full bg-amber-500/15 px-3 py-1 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
          {t('affPartnerFeedLabel')}: {revenue.partnerFeedStatus}
        </span>
      </div>

      {revenue.partnerFeedStatus === 'NOT_CONNECTED' && (
        <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t('affNotConnectedExplain')}
        </div>
      )}

      {/* 8 Commercial Revenue Metrics */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-xs text-muted-foreground">{t('affMetricCampaigns')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
            {revenue.totalCampaigns}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-xs text-muted-foreground">{t('affMetricClicks')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
            {revenue.clicksCount === null ? 'NOT_CONNECTED' : revenue.clicksCount}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-xs text-muted-foreground">{t('affMetricSignups')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
            {revenue.signupsCount}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-xs text-muted-foreground">{t('affMetricConversions')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
            {revenue.qualifiedConversions}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-xs text-muted-foreground">{t('affMetricPendingComm')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-amber-600 dark:text-amber-400">
            {fmtCommission(revenue.pendingCommissionUsd)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-xs text-muted-foreground">{t('affMetricConfirmedComm')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {fmtCommission(revenue.confirmedCommissionUsd)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-xs text-muted-foreground">{t('affMetricAiCost')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
            ${revenue.estimatedAiCostUsd.toFixed(2)} USD
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <dt className="text-xs text-muted-foreground">{t('affMetricNetRevenue')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-primary">
            {fmtNetRevenue()}
          </dd>
        </div>
      </dl>

      {/* Manual Partner Report Entry with Source Provenance */}
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-1 text-xs font-semibold text-foreground">{t('affRecordPerfTitle')}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{t('affRecordPerfSubtitle')}</p>

        {campaigns.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('affRecordPerfNeedCampaign')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t('affPerfCampaignLabel')}
                <select
                  value={selectedCampaignId}
                  disabled={busy}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.campaignName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t('affPerfSourceLabel')}
                <input
                  type="text"
                  maxLength={240}
                  value={reportSource}
                  disabled={busy}
                  placeholder={t('affPerfSourcePlaceholder')}
                  onChange={(e) => setReportSource(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t('affPerfPeriodLabel')}
                <input
                  type="text"
                  maxLength={100}
                  value={reportPeriod}
                  disabled={busy}
                  placeholder="2026-11-W4"
                  onChange={(e) => setReportPeriod(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t('affPerfRefIdLabel')}
                <input
                  type="text"
                  maxLength={128}
                  value={externalRefId}
                  disabled={busy}
                  placeholder="stmt-2026-11-01"
                  onChange={(e) => setExternalRefId(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm text-foreground"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t('affMetricClicks')}
                <input
                  type="number"
                  min={0}
                  value={clicksRaw}
                  disabled={busy}
                  placeholder="—"
                  onChange={(e) => setClicksRaw(e.target.value)}
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t('affMetricSignups')}
                <input
                  type="number"
                  min={0}
                  value={signupsCount}
                  disabled={busy}
                  onChange={(e) => setSignupsCount(Number(e.target.value))}
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t('affMetricConversions')}
                <input
                  type="number"
                  min={0}
                  value={qualifiedConversions}
                  disabled={busy}
                  onChange={(e) => setQualifiedConversions(Number(e.target.value))}
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t('affPendingInputLabel')}
                <input
                  type="number"
                  min={0}
                  step={currency === 'VND' ? '1' : '0.01'}
                  value={pendingCommissionUsd}
                  disabled={busy}
                  onChange={(e) => setPendingCommissionUsd(Number(e.target.value))}
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t('affConfirmedInputLabel')}
                <input
                  type="number"
                  min={0}
                  step={currency === 'VND' ? '1' : '0.01'}
                  value={confirmedCommissionUsd}
                  disabled={busy}
                  onChange={(e) => setConfirmedCommissionUsd(Number(e.target.value))}
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {t('affCurrencyLabel')}
                <select
                  value={currency}
                  disabled={busy}
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'USDT' | 'EUR' | 'VND')}
                  className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground"
                >
                  <option value="USD">USD</option>
                  <option value="USDT">USDT</option>
                  <option value="EUR">EUR</option>
                  <option value="VND">VND</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy || !canRecord}
                onClick={() => void handleSubmit()}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {busy ? t('loading') : t('affRecordPerfBtn')}
              </button>
              {savedNotice && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {t('affRecordPerfSaved')}
                </span>
              )}
            </div>
          </div>
        )}

        {entries.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 text-xs">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5"
              >
                <span className="text-foreground">
                  <strong className="font-mono text-primary">{entry.externalRefId}</strong> ·{' '}
                  {entry.reportSource} ({entry.reportPeriod})
                </span>
                <span className="font-mono text-muted-foreground">
                  +
                  {formatAffiliateCurrencyAmount(
                    (entry.confirmedCommissionCents || 0) / currencySubunitScale(entry.currency),
                    entry.currency,
                  )}{' '}
                  confirmed · +
                  {formatAffiliateCurrencyAmount(
                    (entry.pendingCommissionCents || 0) / currencySubunitScale(entry.currency),
                    entry.currency,
                  )}{' '}
                  pending
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
