'use client';
// i18n-namespace: stitch.pricingPage

/**
 * 14-Day Paid Pilot Guarantee Banner (1,990,000 VND / $79).
 * Initiates BASIC pilot_14d checkout via POST /api/checkout with CSRF protection.
 * @module components/stitch/screens/pricing/view/paid-pilot-banner
 */

import React, { useState, useCallback } from 'react';
import { Check, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getCsrfHeaders, useCsrfToken } from '@/seed/security/use-csrf-token';
import { cn } from '@/seed/utils/cn';
import { useLocale } from 'next-intl';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';

interface ManualPilotBankInstructions {
  configured: boolean;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  transferMemo: string;
  reason?: string;
}

interface PaidPilotCheckoutResponse {
  paymentMethod?: string;
  orderId?: string;
  status?: string;
  provider?: string;
  redirectTo?: string;
  error?: string;
  amountVnd?: number;
  amountUsd?: number;
  transferReference?: string;
  supportEmail?: string;
  bankInstructions?: ManualPilotBankInstructions;
}

export interface PaidPilotBannerProps {
  readonly onRedirect?: (url: string) => void;
}

function isSafeRelativePath(candidate: string | undefined): candidate is string {
  return typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//');
}

function defaultRedirect(url: string): void {
  window.location.href = url;
}

export function PaidPilotBanner({ onRedirect = defaultRedirect }: PaidPilotBannerProps) {
  const t = useTranslations('stitch.pricingPage');
  const csrfHeaders = useCsrfToken();
  const locale = useLocale() === 'en' ? 'en' : 'vi';
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [reservedOrderId, setReservedOrderId] = useState<string | null>(null);
  const [fallbackDetails, setFallbackDetails] = useState<{
    amountVnd: number;
    transferReference: string | null;
    supportEmail: string;
    bankInstructions: ManualPilotBankInstructions | null;
  } | null>(null);
  const [errorActive, setErrorActive] = useState(false);

  const handleStartPilot = useCallback(async () => {
    if (loading || !accepted) return;
    setLoading(true);
    setFallbackActive(false);
    setReservedOrderId(null);
    setFallbackDetails(null);
    setErrorActive(false);

    try {
      const freshCsrf = typeof getCsrfHeaders === 'function' ? getCsrfHeaders() : {};
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders, ...freshCsrf },
        body: JSON.stringify({ tier: 'BASIC', period: 'pilot_14d', paymentMethod: 'offline_bank_transfer', agreement: { accepted: true, version: OPTION_A_PILOT_CONTRACT.termsVersion, hash: OPTION_A_PILOT_CONTRACT.termsHash, locale, channel: 'pricing_banner' } }),
      });
      const data = (await res.json().catch(() => ({}))) as PaidPilotCheckoutResponse;

      if (res.status === 401) {
        const activeSeg =
          typeof window !== 'undefined'
            ? window.location.pathname.split('/')[1] || 'vi'
            : 'vi';
        const safeLoc = /^[a-z]{2}$/.test(activeSeg) ? activeSeg : 'vi';
        const fallbackLogin = `/${safeLoc}/login?next=${encodeURIComponent(`/${safeLoc}/pricing`)}`;
        onRedirect(isSafeRelativePath(data.redirectTo) ? data.redirectTo : fallbackLogin);
        return;
      }
      if (!res.ok) {
        setErrorActive(true);
        return;
      }
      if (data.status === 'pending_manual_payment' && data.paymentMethod === 'offline_bank_transfer') {
        setReservedOrderId(typeof data.orderId === 'string' && data.orderId.length > 0 ? data.orderId : null);
        setFallbackDetails({
          amountVnd: typeof data.amountVnd === 'number' ? data.amountVnd : 1_990_000,
          transferReference: typeof data.transferReference === 'string' ? data.transferReference : null,
          supportEmail: typeof data.supportEmail === 'string' ? data.supportEmail : 'support@mekongmind.com',
          bankInstructions: data.bankInstructions ?? null,
        });
        setFallbackActive(true);
        return;
      }
      setErrorActive(true);
    } catch {
      setErrorActive(true);
    } finally {
      setLoading(false);
    }
  }, [accepted, csrfHeaders, loading, locale, onRedirect]);

  const bullets = [t('paidPilot.bullet1'), t('paidPilot.bullet2'), t('paidPilot.bullet3')];

  return (
    <section
      aria-label={t('paidPilot.badge')}
      className="mb-20 rounded-2xl border border-primary/30 bg-card p-6 sm:p-8 shadow-sm"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary-text">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('paidPilot.badge')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-sans">
            {t('paidPilot.title')}
          </h2>
          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
            {t('paidPilot.subtitle')}
          </p>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 pt-1">
            {bullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-text" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-stretch lg:items-end gap-3 min-w-[240px]">
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.currentTarget.checked)} aria-label={t('paidPilot.agreementCheckbox')} />
            <span>{t('paidPilot.agreementCheckbox')} <span className="block font-mono">{OPTION_A_PILOT_CONTRACT.termsVersion} · {OPTION_A_PILOT_CONTRACT.termsHash}</span></span>
          </label>
          <div className="text-left lg:text-right font-mono">
            <div className="text-3xl font-black tracking-tight text-foreground">{t('paidPilot.priceVnd')}</div>
            <div className="text-xs font-medium text-muted-foreground">{t('paidPilot.priceUsd')}</div>
          </div>
          <button
            type="button"
            disabled={loading || !accepted}
            onClick={handleStartPilot}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-all',
              'bg-primary dark:bg-primary-600 text-primary-foreground dark:text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-primary/20',
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>{t('paidPilot.ctaLoading')}</span>
              </>
            ) : (
              <>
                <span>{t('paidPilot.cta')}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>

      {fallbackActive && (
        <div role="status" className="mt-5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground space-y-2">
          <p>{t('paidPilot.fallbackNotice')}</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>{(fallbackDetails?.amountVnd ?? 1_990_000).toLocaleString('vi-VN')} VND</strong> · {t('paidPilot.fallbackEntitlements')}
            </p>
            {fallbackDetails?.bankInstructions?.configured ? (
              <p className="font-mono text-foreground" data-testid="paid-pilot-bank-instructions">
                {fallbackDetails.bankInstructions.bankName} · {fallbackDetails.bankInstructions.accountNumber} ({fallbackDetails.bankInstructions.accountHolder}) · {t('paidPilot.fallbackMemo', { memo: fallbackDetails.bankInstructions.transferMemo })}
              </p>
            ) : (
              <p data-testid="paid-pilot-bank-pending">
                {t('paidPilot.fallbackBankPending', { email: fallbackDetails?.supportEmail ?? 'support@mekongmind.com' })}
                {fallbackDetails?.transferReference && <> · {t('paidPilot.fallbackMemo', { memo: fallbackDetails.transferReference })}</>}
              </p>
            )}
            {reservedOrderId && (
              <p className="font-mono text-muted-foreground" data-testid="paid-pilot-order-ref">
                {t('paidPilot.fallbackOrderRef', { orderId: reservedOrderId, email: fallbackDetails?.supportEmail ?? 'support@mekongmind.com' })}
              </p>
            )}
          </div>
        </div>
      )}
      {errorActive && (
        <div role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {t('paidPilot.errorNotice')}
        </div>
      )}
    </section>
  );
}
