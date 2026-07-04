'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Share2,
  Users,
  UserCheck,
  DollarSign,
  Clock,
  Link,
  Copy,
  Check,
  Filter,
  Download,
  PlusCircle,
  Wallet,
  TrendingUp,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { Card } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';

/* ───────────────────────────────────────────────────────────────────────────
 *  Types
 * ─────────────────────────────────────────────────────────────────────────── */

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

/* ───────────────────────────────────────────────────────────────────────────
 *  Default data
 * ─────────────────────────────────────────────────────────────────────────── */

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

/* ───────────────────────────────────────────────────────────────────────────
 *  Status badge styles (indigo theme)
 * ─────────────────────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-400',
  pending: 'bg-orange-500/10 text-orange-400',
  clawback: 'bg-red-500/10 text-red-400',
};

/* ───────────────────────────────────────────────────────────────────────────
 *  Social platforms (colored brand buttons from Stitch export v3)
 * ─────────────────────────────────────────────────────────────────────────── */

interface SocialPlatform {
  id: string;
  bg: string;
  path: string;
  ariaLabel: string;
}

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: 'facebook',
    bg: 'bg-[#1877F2]',
    ariaLabel: 'Share on Facebook',
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
  {
    id: 'twitter',
    bg: 'bg-[#1DA1F2]',
    ariaLabel: 'Share on Twitter',
    path: 'M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z',
  },
  {
    id: 'whatsapp',
    bg: 'bg-[#25D366]',
    ariaLabel: 'Share on WhatsApp',
    path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  },
  {
    id: 'telegram',
    bg: 'bg-[#0088CC]',
    ariaLabel: 'Share on Telegram',
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .33z',
  },
];

/* ───────────────────────────────────────────────────────────────────────────
 *  KPI progress bar widths (decorative, from Stitch v1)
 * ─────────────────────────────────────────────────────────────────────────── */

const KPI_PROGRESS: Record<string, string> = {
  totalReferrals: 'w-2/3',
  active: 'w-1/2',
  commissionEarned: 'w-3/4',
  pending: 'w-1/3',
};

/* ───────────────────────────────────────────────────────────────────────────
 *  SocialIcon SVG component
 * ─────────────────────────────────────────────────────────────────────────── */

function SocialIcon({ path, className }: { path: string; className?: string }) {
  return (
    <svg className={cn('w-5 h-5 fill-current', className)} viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  AffiliateDashboardPage
 * ═══════════════════════════════════════════════════════════════════════════ */

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
  const glowRef = useRef<HTMLDivElement>(null);

  const metrics = kpiMetrics ?? DEFAULT_METRICS;
  const offerItems = offers ?? DEFAULT_OFFERS;
  const conversionRows = conversions ?? DEFAULT_CONVERSIONS;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── Mouse-tracking glow (Stitch v1 atmospheric effect) ───────── */
  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;

    const handleMouse = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      el.style.setProperty('--mouse-x', String(x));
      el.style.setProperty('--mouse-y', String(y));
    };

    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  return (
    <main
      className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative"
      aria-label={t('aria.mainContent')}
    >
      {/* ── Mouse-tracking glow overlay ──────────────────────────── */}
      <div
        ref={glowRef}
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(circle at calc(var(--mouse-x, 0.5) * 100%) calc(var(--mouse-y, 0.5) * 100%), rgba(99, 102, 241, 0.04) 0%, transparent 50%)',
        }}
        aria-hidden="true"
      />

      {/* Content wrapper (above glow) */}
      <div className="relative z-10">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-foreground tracking-tight">
              {t('title')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
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
        </div>

        {/* ── KPI Section (Stitch v1 with progress bars) ──────────── */}
        <section
          aria-label={t('aria.kpiSection')}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const progressWidth = KPI_PROGRESS[metric.id] || 'w-1/2';
            return (
              <Card
                key={metric.id}
                glass
                hover
                className="p-5 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t(`kpi.${metric.id}.label`)}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                  </div>
                </div>
                <h3 className="text-2xl font-semibold text-foreground">
                  {metric.value}
                </h3>
                {/* Progress bar (from Stitch v1 design) */}
                <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full bg-primary rounded-full transition-all duration-700 group-hover:opacity-80',
                      progressWidth,
                    )}
                  />
                </div>
              </Card>
            );
          })}
        </section>

        {/* ── Main Grid ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* ── Left: Affiliate Offers ────────────────────────────── */}
          <section aria-label={t('aria.offersSection')}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" aria-hidden="true" />
                {t('offers.title')}
              </h2>
              <Button
                variant="link"
                className="text-primary text-sm font-medium p-0 h-auto gap-1"
                aria-label={t('offers.viewAll')}
              >
                {t('offers.viewAll')}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {offerItems.map((offer, index) => {
                const isFeatured = index === 2; // ClickBank as featured
                return (
                  <Card
                    key={offer.id}
                    glass
                    hover
                    className={cn(
                      'p-6 relative overflow-hidden',
                      isFeatured && 'border-primary/40',
                    )}
                  >
                    {/* HOT badge (from Stitch v1) */}
                    {isFeatured && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-3 py-1 rounded-bl-lg font-bold z-10">
                        HOT
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-lg bg-surface-container-highest p-2 border border-border shrink-0">
                        <img
                          className="w-full h-full object-contain"
                          src={offer.iconUrl}
                          alt={offer.iconAlt}
                        />
                      </div>
                      <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight whitespace-nowrap">
                        {offer.commissionLabel}
                      </span>
                    </div>
                    <h3 className="font-bold text-foreground mb-4">
                      {offer.name}
                    </h3>
                    <Button
                      variant={isFeatured ? 'default' : 'outline'}
                      className={cn(
                        'w-full',
                        isFeatured && 'shadow-lg shadow-primary/20',
                      )}
                      size="sm"
                      aria-label={`${t('offers.promote')} ${offer.name}`}
                    >
                      {t('offers.promote')}
                    </Button>
                  </Card>
                );
              })}

              {/* Browse More card (from Stitch v2/v3) */}
              <button
                className="border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground group"
                aria-label={t('offers.browseMore')}
              >
                <PlusCircle className="w-7 h-7 mb-2 group-hover:text-primary transition-colors" aria-hidden="true" />
                <span className="text-sm font-medium group-hover:text-primary transition-colors">
                  {t('offers.browseMore')}
                </span>
              </button>
            </div>
          </section>

          {/* ── Right: Recent Conversions ────────────────────────── */}
          <section aria-label={t('aria.conversionsSection')}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">
                {t('conversions.title')}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg text-muted-foreground hover:text-foreground"
                  aria-label={t('common.filter')}
                >
                  <Filter className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg text-muted-foreground hover:text-foreground"
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
                      <tr
                        key={row.id}
                        className="hover:bg-surface-container-high/50 transition-all duration-200 hover:translate-x-1 cursor-default"
                      >
                        <td className="px-6 py-4 text-foreground whitespace-nowrap font-mono text-[11px]">
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
                              'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight',
                              STATUS_STYLES[row.status],
                            )}
                          >
                            {t(`conversions.status.${row.status}`)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground whitespace-nowrap text-xs">
                          {row.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* View All footer (from Stitch v3) */}
              <div className="bg-surface-container-low px-6 py-3 text-center border-t border-border/30">
                <Button
                  variant="link"
                  className="text-primary text-xs font-bold hover:underline p-0 h-auto"
                  aria-label={t('conversions.viewAll')}
                >
                  {t('conversions.viewAll')}
                  <ExternalLink className="w-3 h-3 ml-1" aria-hidden="true" />
                </Button>
              </div>
            </Card>
          </section>
        </div>

        {/* ── Referral Link Section ──────────────────────────────── */}
        <section
          aria-label={t('aria.referralSection')}
          className={cn(
            'p-8 rounded-2xl mb-8',
            'bg-gradient-to-br from-surface-container-low to-background',
            'border border-primary/20',
          )}
        >
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Link className="w-5 h-5 text-primary" aria-hidden="true" />
            {t('referral.title')}
          </h2>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 bg-surface-container-highest/50 border border-border rounded-xl flex items-center px-4 py-3">
              <code className="text-primary font-mono text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {referralLink}
              </code>
              <Button
                variant="default"
                size="sm"
                className={cn(
                  'ml-4 shrink-0 gap-2 transition-colors',
                  copied ? 'bg-green-500 hover:bg-green-600' : '',
                )}
                onClick={handleCopyLink}
                aria-label={copied ? t('referral.copied') : t('referral.copyButton')}
              >
                {copied ? (
                  <Check className="w-[18px] h-[18px]" aria-hidden="true" />
                ) : (
                  <Copy className="w-[18px] h-[18px]" aria-hidden="true" />
                )}
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
                    'w-10 h-10 rounded-full flex items-center justify-center text-white',
                    platform.bg,
                    'hover:opacity-80 transition-opacity active:scale-90',
                  )}
                  aria-label={platform.ariaLabel}
                >
                  <SocialIcon path={platform.path} />
                </button>
              ))}
            </div>
          </div>

          {/* Info note (from Stitch v3) */}
          <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground bg-surface-container p-4 rounded-xl">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">info</span>
            <p>{t('referral.info')}</p>
          </div>
        </section>

        {/* ── Wallet Section (Stitch v3 layout) ──────────────────── */}
        <section
          aria-label={t('aria.walletSection')}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div
            className={cn(
              'md:col-span-2 p-6 sm:p-8 rounded-2xl border border-border',
              'bg-surface-container-low',
            )}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" aria-hidden="true" />
                  {t('wallet.title')}
                </h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {t('wallet.addressLabel')}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-primary border-primary/30 text-xs font-bold"
                aria-label={t('wallet.editAddress')}
              >
                {t('wallet.editAddress')}
              </Button>
            </div>
            <div className="mt-6">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2 tracking-widest">
                {t('wallet.addressLabel')}
              </p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl text-foreground break-all">
                  {walletAddress}
                </span>
                <span className="text-primary" aria-hidden="true">
                  <Check className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>

          <div
            className={cn(
              'p-6 sm:p-8 rounded-2xl border border-primary/30 flex flex-col justify-between',
              'bg-surface-container-low',
            )}
          >
            <div>
              <p className="text-sm font-medium text-primary">
                {t('wallet.availableBalance')}
              </p>
              <h4 className="text-4xl font-black text-foreground mt-2">
                {walletBalance}
              </h4>
            </div>
            <div className="space-y-3 mt-6">
              <Button
                variant="default"
                size="lg"
                className="w-full shadow-lg shadow-primary/20 gap-2"
                aria-label={t('wallet.withdraw')}
              >
                {t('wallet.withdraw')}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground italic">
                {t('wallet.minimumWithdrawal', { amount: '$50.00' })}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
