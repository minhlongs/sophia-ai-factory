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
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import { cn } from '@/seed/utils/cn';

interface PaidPilotCheckoutResponse {
  url?: string;
  orderId?: string;
  status?: string;
  provider?: string;
  redirectTo?: string;
  error?: string;
}

export interface PaidPilotBannerProps {
  readonly onRedirect?: (url: string) => void;
}

const ALLOWED_PAYMENT_HOSTS = new Set(['pay.payos.vn', 'checkout.payos.vn', 'sophia.agencyos.network']);

function isSafeRelativePath(candidate: string | undefined): candidate is string {
  return typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//');
}

function isAllowedCheckoutUrl(candidate: string | undefined): candidate is string {
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' && ALLOWED_PAYMENT_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function defaultRedirect(url: string): void {
  window.location.href = url;
}

export function PaidPilotBanner({ onRedirect = defaultRedirect }: PaidPilotBannerProps) {
  const t = useTranslations('stitch.pricingPage');
  const csrfHeaders = useCsrfToken();
  const [loading, setLoading] = useState(false);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [errorActive, setErrorActive] = useState(false);

  const handleStartPilot = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setFallbackActive(false);
    setErrorActive(false);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders },
        body: JSON.stringify({ tier: 'BASIC', period: 'pilot_14d', paymentMethod: 'payos' }),
      });
      const data = (await res.json().catch(() => ({}))) as PaidPilotCheckoutResponse;

      if (res.status === 401) {
        onRedirect(isSafeRelativePath(data.redirectTo) ? data.redirectTo : '/vi/login?next=%2Fvi%2Fpricing');
        return;
      }
      if (!res.ok) {
        setErrorActive(true);
        return;
      }
      if (data.status === 'pending_manual_payment') {
        setFallbackActive(true);
        return;
      }
      if (isAllowedCheckoutUrl(data.url)) {
        onRedirect(data.url);
        return;
      }
      setErrorActive(true);
    } catch {
      setErrorActive(true);
    } finally {
      setLoading(false);
    }
  }, [csrfHeaders, loading, onRedirect]);

  const bullets = [t('paidPilot.bullet1'), t('paidPilot.bullet2'), t('paidPilot.bullet3')];

  return (
    <section
      aria-label={t('paidPilot.badge')}
      className="mb-20 rounded-2xl border border-primary/30 bg-card p-6 sm:p-8 shadow-sm"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('paidPilot.badge')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display">
            {t('paidPilot.title')}
          </h2>
          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
            {t('paidPilot.subtitle')}
          </p>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 pt-1">
            {bullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-stretch lg:items-end gap-3 min-w-[240px]">
          <div className="text-left lg:text-right font-mono">
            <div className="text-3xl font-black tracking-tight text-foreground">{t('paidPilot.priceVnd')}</div>
            <div className="text-xs font-medium text-muted-foreground">{t('paidPilot.priceUsd')}</div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={handleStartPilot}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-all',
              'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-primary/20',
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
        <div role="status" className="mt-5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground">
          {t('paidPilot.fallbackNotice')}
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
