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
  Download,
  Wallet,
  Globe,
  GitBranch,
  Rocket,
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
  subtext?: string;
  subtextColor?: string;
}

interface AffiliateOffer {
  id: string;
  name: string;
  description: string;
  commissionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBgClass: string;
  iconColorClass: string;
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
  {
    id: 'commissionEarned',
    value: '$3,847',
    icon: DollarSign,
    subtext: '+12% from last month',
    subtextColor: 'text-green-400',
  },
  {
    id: 'pending',
    value: '$892',
    icon: Clock,
    subtext: 'Estimated payout: Oct 15',
    subtextColor: 'text-muted-foreground',
  },
];

const DEFAULT_OFFERS: AffiliateOffer[] = [
  {
    id: 'tiktokShop',
    name: 'TikTok Shop Global',
    description: 'Creator marketplace integration',
    commissionLabel: '15% Comm.',
    icon: Globe,
    iconBgClass: 'bg-black',
    iconColorClass: 'text-white',
  },
  {
    id: 'accessTrade',
    name: 'AccessTrade Network',
    description: 'E-commerce affiliate bundle',
    commissionLabel: '12% Comm.',
    icon: GitBranch,
    iconBgClass: 'bg-primary/10',
    iconColorClass: 'text-white',
  },
  {
    id: 'clickbank',
    name: 'ClickBank Exclusive',
    description: 'Digital information products',
    commissionLabel: '20% Comm.',
    icon: Wallet,
    iconBgClass: 'bg-slate-100',
    iconColorClass: 'text-slate-900',
  },
  {
    id: 'sophiaProMax',
    name: 'Sophia Pro Max',
    description: 'Flagship AI subscription plan',
    commissionLabel: '25% Comm.',
    icon: Rocket,
    iconBgClass: 'bg-primary/10/20',
    iconColorClass: 'text-primary',
  },
];

const DEFAULT_CONVERSIONS: ConversionRow[] = [
  { id: '1', transactionId: '#C-84729', amount: '$499.00', commission: '$74.85', status: 'paid', date: '2023-10-12' },
  { id: '2', transactionId: '#C-84730', amount: '$129.00', commission: '$15.48', status: 'pending', date: '2023-10-12' },
  { id: '3', transactionId: '#C-84731', amount: '$2,500.00', commission: '$375.00', status: 'paid', date: '2023-10-11' },
  { id: '4', transactionId: '#C-84732', amount: '$89.00', commission: '$13.35', status: 'clawback', date: '2023-10-11' },
  { id: '5', transactionId: '#C-84733', amount: '$499.00', commission: '$74.85', status: 'pending', date: '2023-10-10' },
  { id: '6', transactionId: '#C-84734', amount: '$1,200.00', commission: '$180.00', status: 'pending', date: '2023-10-10' },
];

/* ───────────────────────────────────────────────────────────────────────────
 *  Status badge styles
 * ─────────────────────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-400',
  pending: 'bg-primary/10/10 text-primary',
  clawback: 'bg-red-500/10 text-red-400',
};

/* ───────────────────────────────────────────────────────────────────────────
 *  KPI progress bar widths (decorative)
 * ─────────────────────────────────────────────────────────────────────────── */

const KPI_PROGRESS: Record<string, string> = {
  totalReferrals: 'w-2/3',
  active: 'w-1/2',
  commissionEarned: 'w-3/4',
  pending: 'w-1/3',
};

/* ───────────────────────────────────────────────────────────────────────────
 *  Social platforms
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
    path: 'M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.303.48-.429-.012-1.253-.245-1.865-.444-.753-.245-1.353-.375-1.3-.79.029-.215.325-.437.888-.667 3.5-1.523 5.837-2.525 7.013-3.007 3.34-1.37 4.034-1.608 4.487-1.616z',
  },
];

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
  walletAddress = 'TJ9w8D7s...mK2n9R1v',
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

  /* ── Mouse-tracking glow ────────────────────────────────────────── */
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
      {/* ── Mouse-tracking glow overlay ────────────────────────────── */}
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
        {/* ── Header ────────────────────────────────────────────────── */}
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

        {/* ── KPI Section ───────────────────────────────────────────── */}
        <section
          aria-label={t('aria.kpiSection')}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const progressWidth = KPI_PROGRESS[metric.id] || 'w-1/2';
            return (
              <Card key={metric.id} glass hover className="p-5 group">
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
                {metric.subtext && (
                  <p className={cn('text-[10px] font-medium mt-0.5', metric.subtextColor ?? 'text-muted-foreground')}>
                    {metric.subtext}
                  </p>
                )}
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

        {/* ── Main 2-Column Grid ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* ── Left: Affiliate Offers ───────────────────────────────── */}
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
              {offerItems.map((offer, index) => {
                const isFeatured = index === 3; // Sophia Pro Max = featured HOT
                return (
                  <Card
                    key={offer.id}
                    glass
                    hover
                    className={cn(
                      'p-4 relative overflow-hidden',
                      isFeatured && 'border-primary/30',
                    )}
                  >
                    {isFeatured && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-3 py-1 rounded-bl-lg font-bold z-10">
                        HOT
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden',
                          offer.iconBgClass,
                        )}
                      >
                        <offer.icon className={cn('text-2xl', offer.iconColorClass)} />
                      </div>
                      <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                        {offer.commissionLabel}
                      </span>
                    </div>
                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-1">
                      {offer.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      {offer.description}
                    </p>
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
            </div>
          </section>

          {/* ── Right: Recent Conversions ───────────────────────────── */}
          <section aria-label={t('aria.conversionsSection')}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">
                {t('conversions.title')}
              </h2>
              <span className="text-xs text-muted-foreground font-medium">
                Last 24 hours: 14 sales
              </span>
            </div>

            <Card glass className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">{t('aria.conversionsTable')}</caption>
                  <thead>
                    <tr className="bg-surface-container-high text-muted-foreground">
                      <th scope="col" className="px-4 py-3 font-bold uppercase text-[10px] tracking-wider">
                        Conv. ID
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold uppercase text-[10px] tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold uppercase text-[10px] tracking-wider">
                        Comm.
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold uppercase text-[10px] tracking-wider text-center">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 font-bold uppercase text-[10px] tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {conversionRows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-surface-container-high/50 transition-colors cursor-default"
                      >
                        <td className="px-4 py-3 text-foreground whitespace-nowrap font-mono text-xs text-primary">
                          {row.transactionId}
                        </td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {row.amount}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 font-bold whitespace-nowrap',
                            row.status === 'paid' && 'text-green-400',
                            row.status === 'pending' && 'text-primary',
                            row.status === 'clawback' && 'text-red-400',
                          )}
                        >
                          {row.commission}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold',
                              STATUS_STYLES[row.status],
                            )}
                          >
                            {t(`conversions.status.${row.status}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {row.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-surface-container-low px-4 py-3 text-center border-t border-border/30">
                <button className="text-xs font-bold text-primary hover:underline uppercase tracking-widest">
                  {t('conversions.downloadReport')}
                </button>
              </div>
            </Card>
          </section>
        </div>

        {/* ── Bottom 3-Column Grid (Referral + Wallet) ──────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          {/* ── Referral Link (colspan 2) ────────────────────────────── */}
          <section
            aria-label={t('aria.referralSection')}
            className="xl:col-span-2 bg-surface-container border border-border p-6 rounded-2xl flex flex-col gap-6"
          >
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">
                {t('referral.title')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('referral.description')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface-container-lowest border border-border rounded-xl px-4 py-3.5 font-mono text-primary text-sm overflow-hidden whitespace-nowrap">
                {referralLink}
              </div>
              <Button
                variant="default"
                size="lg"
                className={cn(
                  'shrink-0 gap-2 transition-colors shadow-md shadow-primary/20',
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

            <div className="flex items-center gap-4">
              <span className="text-xs font-label text-muted-foreground uppercase tracking-wider">
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
          </section>

          {/* ── Wallet Section ────────────────────────────────────────── */}
          <section
            aria-label={t('aria.walletSection')}
            className="bg-surface-container border border-border p-6 rounded-2xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {t('wallet.title')}
                </span>
                <Wallet className="w-5 h-5 text-green-400" aria-hidden="true" />
              </div>
              <div className="bg-surface-container-lowest px-3 py-2 rounded-lg border border-border/30 flex items-center justify-between mb-6">
                <span className="text-xs font-mono text-muted-foreground">{walletAddress}</span>
                <Copy className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-primary transition-colors" aria-hidden="true" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                {t('wallet.availableBalance')}
              </p>
              <h4 className="text-4xl font-bold text-foreground mb-6">{walletBalance}</h4>
            </div>
            <div>
              <Button
                variant="default"
                size="lg"
                className="w-full shadow-md shadow-primary/20 mb-3"
                aria-label={t('wallet.withdraw')}
              >
                {t('wallet.withdraw')}
              </Button>
              <p className="text-[12px] text-center text-muted-foreground italic">
                {t('wallet.minimumWithdrawal', { amount: '$50.00' })}
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
