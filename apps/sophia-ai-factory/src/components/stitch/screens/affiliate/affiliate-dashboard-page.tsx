'use client';

import React, { useState } from 'react';
import {
  Share2,
  Users,
  UserCheck,
  DollarSign,
  Clock,
  Link,
  Copy,
  Filter,
  Download,
  PlusCircle,
  Wallet,
  Eye,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { Card, CardContent } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Input } from '@/seed/components/ui/input';

/* ───────────────────────────────────────────────────────────────
 * Types
 * ─────────────────────────────────────────────────────────────── */

interface KpiMetric {
  id: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AffiliateOffer {
  id: string;
  name: string;
  commissionLabel: string;
  iconUrl: string;
  iconAlt: string;
}

interface ConversionRow {
  id: string;
  transactionId: string;
  amount: string;
  commission: string;
  status: 'paid' | 'pending' | 'clawback';
  date: string;
}

export interface AffiliateDashboardPageProps {
  kpiMetrics?: KpiMetric[];
  offers?: AffiliateOffer[];
  conversions?: ConversionRow[];
  referralLink?: string;
  walletAddress?: string;
  walletBalance?: string;
}

/* ───────────────────────────────────────────────────────────────
 * Default data
 * ─────────────────────────────────────────────────────────────── */

const DEFAULT_METRICS: KpiMetric[] = [
  { id: 'totalReferrals', value: '47', icon: Users },
  { id: 'active', value: '32', icon: UserCheck },
  { id: 'commissionEarned', value: '$3,847', icon: DollarSign },
  { id: 'pending', value: '$892', icon: Clock },
];

const DEFAULT_OFFERS: AffiliateOffer[] = [
  {
    id: 'tiktokShop',
    name: 'TikTok Shop',
    commissionLabel: '15% Comm.',
    iconUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBnEdqaJgbgsRQRJR7YfbGaoTWoLavohXlUu76qaAymhvnbTJKwjLSAPdiVBGNIR0xFv3GzpNC0WjrsRg2o6gTMazA3LxtU1GWukgPWhUT5epysxqiG3brwOufh3zR4Q3lV107jtBW2lrlRYDU0XRxzvdlhs2LNC_aKprHwiPENyduShmFoY7l3juWuknrnufEO9OC62Hysx9CZ0ReuhKyeBH3kF7Mc8SDFyJmf2vbqknFgGPo31HIJNqr3sQgM1LWY8KYv3-phFq4',
    iconAlt: 'TikTok logo',
  },
  {
    id: 'accessTrade',
    name: 'AccessTrade',
    commissionLabel: '10% Comm.',
    iconUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB9-xL5gMztPKejHq5aUxb9yD8Wyeqy08QZwrtzCz6NArLqwCCndopVFlgtc6DX84mVQAJ4gbyUXrEJSXlHT1yGtqyXayvLdEaT3TFzheJko7A_wLXOIJQV1Ya2nXeHzxZCJ0SyYox10Hby64sIsBMRuSMpDFXy9a-uB3PC8bF4rH5Dupcg66nw5Pg4MKyNPGgJXx-8ikncdcWK_6d6DpgLA-ln5jDrnWBv-kWQu4z1BBibl_uUBO-OzGsMQlZ05UHNENj9uqgjjmU',
    iconAlt: 'AccessTrade logo',
  },
  {
    id: 'clickbank',
    name: 'ClickBank',
    commissionLabel: '20% Comm.',
    iconUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA4CqbdijYkWM5X0W8jIhpkacLQfGnUm9fRHdPySX8ceLZQt2KBD3OLdMAHpaTnBqJ-dnhVgZW2IMsDF_bvLg6LTeWjWsbIqr71EtFd0BkhR5MpRQXLeQGZ4UrnEyl_cPXqUNAvpxOWMA6e8zpuSDmEkDYtT1EYr4beZ6bkILRo3vEG9bQ6l3HY_27L7TcPN02LAFMtuJcZnpLmMTEHaBW743WKIQv9RBWJcq934mak8EwtDRehzV3ACXaXVI_aX0V1J6IgCp_ebrg',
    iconAlt: 'ClickBank logo',
  },
];

const DEFAULT_CONVERSIONS: ConversionRow[] = [
  { id: '1', transactionId: '#TRX-9421', amount: '$120.00', commission: '$18.00', status: 'paid', date: 'Oct 24, 2023' },
  { id: '2', transactionId: '#TRX-9418', amount: '$450.00', commission: '$67.50', status: 'pending', date: 'Oct 23, 2023' },
  { id: '3', transactionId: '#TRX-9415', amount: '$89.00', commission: '$13.35', status: 'paid', date: 'Oct 22, 2023' },
  { id: '4', transactionId: '#TRX-9402', amount: '$250.00', commission: '$37.50', status: 'clawback', date: 'Oct 20, 2023' },
  { id: '5', transactionId: '#TRX-9398', amount: '$1,200.00', commission: '$180.00', status: 'pending', date: 'Oct 19, 2023' },
  { id: '6', transactionId: '#TRX-9391', amount: '$75.00', commission: '$11.25', status: 'paid', date: 'Oct 18, 2023' },
];

/* ───────────────────────────────────────────────────────────────
 * Status badge styles
 * ─────────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-400',
  pending: 'bg-orange-500/10 text-orange-400',
  clawback: 'bg-red-500/10 text-red-400',
};

/* ───────────────────────────────────────────────────────────────
 * Social share config
 * ─────────────────────────────────────────────────────────────── */

interface SocialPlatform {
  id: string;
  label: string;
  ariaLabel: string;
}

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { id: 'facebook', label: 'FB', ariaLabel: 'Share on Facebook' },
  { id: 'twitter', label: 'X', ariaLabel: 'Share on Twitter' },
  { id: 'whatsapp', label: 'WA', ariaLabel: 'Share on WhatsApp' },
  { id: 'telegram', label: 'TG', ariaLabel: 'Share on Telegram' },
];

/* ════════════════════════════════════════════════════════════════════
 * AffiliateDashboardPage
 * ════════════════════════════════════════════════════════════════════ */

export default function AffiliateDashboardPage({
  kpiMetrics,
  offers,
  conversions,
  referralLink = 'https://sophia.agencyos.network/r/jane-8472',
  walletAddress = 'TY5n...9K2mB7',
  walletBalance = '$247.00',
}: AffiliateDashboardPageProps) {
  const t = useTranslations('stitch.affiliate');
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const metrics = kpiMetrics ?? DEFAULT_METRICS;
  const offerItems = offers ?? DEFAULT_OFFERS;
  const conversionRows = conversions ?? DEFAULT_CONVERSIONS;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <main
      className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
      aria-label={t('aria.mainContent')}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-foreground tracking-tight">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>
        <Button
          variant="default"
          size="lg"
          className="shadow-xl shadow-primary/20 gap-2"
          aria-label={t('referButton')}
        >
          <Share2 className="w-4 h-4" aria-hidden="true" />
          {t('referButton')}
        </Button>
      </div>

      {/* ── KPI Section ─────────────────────────────────────── */}
      <section
        aria-label={t('aria.kpiSection')}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card
              key={metric.id}
              glass
              className="p-5"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {t(`kpi.${metric.id}.label`)}
                  </p>
                  <h3 className="text-[24px] font-semibold text-foreground mt-0.5">
                    {metric.value}
                  </h3>
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      {/* ── Main Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* ── Left: Affiliate Offers ──────────────────────────── */}
        <section aria-label={t('aria.offersSection')}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">
              {t('offers.title')}
            </h2>
            <Button
              variant="link"
              className="text-primary text-sm font-medium p-0 h-auto"
              aria-label={t('offers.viewAll')}
            >
              {t('offers.viewAll')}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {offerItems.map((offer) => (
              <Card
                key={offer.id}
                glass
                hover
                className="p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-lg bg-surface-container-highest p-2 border border-border shrink-0">
                    <img
                      className="w-full h-full object-contain"
                      src={offer.iconUrl}
                      alt={offer.iconAlt}
                    />
                  </div>
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight whitespace-nowrap">
                    {t(`offers.items.${offer.id}.commission`)}
                  </span>
                </div>
                <h3 className="font-bold text-foreground mb-4">
                  {t(`offers.items.${offer.id}.name`)}
                </h3>
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  aria-label={`${t('offers.promote')} ${t(`offers.items.${offer.id}.name`)}`}
                >
                  {t('offers.promote')}
                </Button>
              </Card>
            ))}

            {/* Browse More card */}
            <button
              className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground group"
              aria-label={t('offers.browseMore')}
            >
              <PlusCircle className="w-7 h-7 mb-2 group-hover:text-primary transition-colors" aria-hidden="true" />
              <span className="text-sm font-medium group-hover:text-primary transition-colors">
                {t('offers.browseMore')}
              </span>
            </button>
          </div>
        </section>

        {/* ── Right: Recent Conversions ──────────────────────── */}
        <section aria-label={t('aria.conversionsSection')}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">
              {t('conversions.title')}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg"
                aria-label={t('common.filter')}
              >
                <Filter className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg"
                aria-label={t('common.export')}
              >
                <Download className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <Card glass className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t('aria.conversionsTable')}</caption>
                <thead>
                  <tr className="bg-surface-container-high text-muted-foreground">
                    <th scope="col" className="px-6 py-4 font-bold uppercase text-[10px] tracking-widest">
                      {t('conversions.columns.id')}
                    </th>
                    <th scope="col" className="px-6 py-4 font-bold uppercase text-[10px] tracking-widest">
                      {t('conversions.columns.amount')}
                    </th>
                    <th scope="col" className="px-6 py-4 font-bold uppercase text-[10px] tracking-widest">
                      {t('conversions.columns.commission')}
                    </th>
                    <th scope="col" className="px-6 py-4 font-bold uppercase text-[10px] tracking-widest">
                      {t('conversions.columns.status')}
                    </th>
                    <th scope="col" className="px-6 py-4 font-bold uppercase text-[10px] tracking-widest">
                      {t('conversions.columns.date')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {conversionRows.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-container-high transition-colors">
                      <td className="px-6 py-4 text-foreground whitespace-nowrap">
                        {row.transactionId}
                      </td>
                      <td className="px-6 py-4 font-medium whitespace-nowrap">
                        {row.amount}
                      </td>
                      <td className="px-6 py-4 text-primary font-bold whitespace-nowrap">
                        {row.commission}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'px-3 py-1 rounded-full text-[10px] font-bold',
                            STATUS_STYLES[row.status],
                          )}
                        >
                          {t(`conversions.status.${row.status}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {row.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>

      {/* ── Referral Link Section ────────────────────────────── */}
      <section
        aria-label={t('aria.referralSection')}
        className={cn(
          'p-8 rounded-2xl mb-8',
          'bg-surface-container-low border border-primary/20',
          'bg-gradient-to-br from-surface-container-low to-background',
        )}
      >
        <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
          <Link className="w-5 h-5 text-primary" aria-hidden="true" />
          {t('referral.title')}
        </h2>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 bg-surface-container-highest/50 border border-border rounded-xl flex items-center px-4 py-3">
            <code className="text-primary font-mono text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {referralLink}
            </code>
            <Button
              variant="default"
              size="sm"
              className="ml-4 shrink-0 gap-2"
              onClick={handleCopyLink}
              aria-label={copied ? t('referral.copied') : t('referral.copyButton')}
            >
              <Copy className="w-[18px] h-[18px]" aria-hidden="true" />
              <span>{copied ? t('referral.copied') : t('referral.copyButton')}</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">
            {t('referral.shareLabel')}
          </span>
          <div className="flex gap-3">
            {SOCIAL_PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  'bg-surface-container-low/80 backdrop-blur-lg border border-border',
                  'hover:bg-primary/20 hover:border-primary transition-all text-xs font-bold text-muted-foreground hover:text-primary',
                )}
                aria-label={platform.ariaLabel}
              >
                {platform.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Wallet Section ───────────────────────────────────── */}
      <section
        aria-label={t('aria.walletSection')}
        className={cn(
          'p-6 sm:p-8 rounded-2xl border border-primary/10',
          'bg-surface-container-low border-border',
        )}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center border border-border shrink-0">
              <Wallet
                className="w-7 h-7 text-primary"
                aria-hidden="true"
                style={{ fontVariationSettings: "'FILL' 1" }}
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {t('wallet.title')}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-muted-foreground font-mono text-sm">
                  {walletAddress}
                </span>
                <Eye
                  className="w-4 h-4 cursor-pointer hover:text-primary transition-colors text-muted-foreground"
                  aria-label={t('wallet.toggleVisibility')}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                {t('wallet.availableBalance')}
              </p>
              <h4 className="text-2xl font-bold text-foreground">
                {walletBalance}
              </h4>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button
                variant="default"
                size="lg"
                className="shadow-lg shadow-primary/20"
                aria-label={t('wallet.withdraw')}
              >
                {t('wallet.withdraw')}
              </Button>
              <p className="text-[12px] text-muted-foreground italic">
                {t('wallet.minimumWithdrawal', { amount: '$50.00' })}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
