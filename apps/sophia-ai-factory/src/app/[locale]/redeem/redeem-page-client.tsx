'use client';

/**
 * Redeem page client — form for free promo codes (FREE100 etc).
 * Submits to /api/promo/redeem-free, shows the magic link on success.
 *
 * @module app/[locale]/redeem/redeem-page-client
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, CheckCircle2, AlertTriangle, Gift, Mail, ArrowRight } from 'lucide-react';

interface Props {
  locale: string;
  initialCode: string;
}

interface RedeemSuccess {
  success: true;
  redemptionId: string;
  magicLink?: string | null;
  handoverId?: string;
  trialDaysGranted?: number;
  /** Set when handover succeeded but magic link generation failed */
  handoverError?: string;
}

interface RedeemError {
  error: string;
  reason?: string;
  hint?: string;
}

export function RedeemPageClient({ locale: _locale, initialCode }: Props) {
  const t = useTranslations("redeem");
  const [code, setCode] = useState(initialCode);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<RedeemSuccess | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isVi = _locale.startsWith('vi');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/promo/redeem-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
          fullName: fullName.trim() || undefined,
          tier: 'MASTER',
          locale: isVi ? 'vi' : 'en',
        }),
      });

      const data = (await res.json()) as RedeemSuccess | RedeemError;

      if (!res.ok || !('success' in data)) {
        const err = data as RedeemError;
        const reason = err.reason ?? err.error;
        const reasonKey = reason ? `reason.${reason}` : null;
        setErrorMsg(
          reasonKey ? t(reasonKey) : t('error_generic'),
        );
        return;
      }

      setSuccess(data);
    } catch {
      setErrorMsg(t('error_connection'));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <SuccessView
        locale={_locale}
        email={email}
        magicLink={success.magicLink ?? null}
        handoverError={success.handoverError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-blue-900/10 to-transparent pointer-events-none" />
      <div className="relative max-w-md w-full">
        <div className="bg-card/80 backdrop-blur border border-border rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary-600/20 border border-primary-500/30">
            <Gift size={26} className="text-primary-300" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">{t('title')}</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">{t('subtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={t('promo_code')}>
              <input
                type="text"
                required
                autoComplete="off"
                placeholder="FREE100"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-white placeholder:text-muted-foreground font-mono uppercase tracking-wider focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-violet-500"
                maxLength={30}
              />
            </Field>

            <Field label={t('email')}>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="ban@congty.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-violet-500"
                maxLength={200}
              />
            </Field>

            <Field label={t('name')}>
              <input
                type="text"
                autoComplete="name"
                placeholder={t('name_placeholder')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-violet-500"
                maxLength={100}
              />
            </Field>

            {errorMsg && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-sm">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !code || !email}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <Loader2 size={18} className="motion-safe:animate-spin" />
              ) : (
                <>
                  {t('submit')}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">{t('terms')}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function SuccessView({
  locale: _locale,
  email,
  magicLink,
  handoverError,
}: {
  locale: string;
  email: string;
  magicLink: string | null;
  handoverError?: string;
}) {
  const t = useTranslations("redeem");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-blue-900/10 to-transparent pointer-events-none" />
      <div className="relative max-w-md w-full">
        <div className="bg-card/80 backdrop-blur border border-emerald-500/30 rounded-2xl shadow-xl p-8 text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-600/20 border border-emerald-500/30">
            <CheckCircle2 size={30} className="text-emerald-300" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('success_title')}</h1>
          <p className="text-sm text-muted-foreground mb-6">{t('success_subtitle')}</p>

          {magicLink ? (
            <a
              href={magicLink}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold text-base shadow-lg shadow-violet-900/30 transition-all focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none mb-4"
            >
              {t('get_started')}
              <ArrowRight size={18} />
            </a>
          ) : handoverError ? (
            <div className="mb-4 px-4 py-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-left">
              <p className="text-sm text-amber-300 mb-3">{t('activation_error')}</p>
              <a
                href="mailto:support@mekongmind.com"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-200 text-sm font-medium hover:bg-amber-600/30 transition-colors"
              >
                <Mail size={14} />
                support@mekongmind.com
              </a>
            </div>
          ) : (
            <p className="text-sm text-amber-300 mb-4">
              {t('link_generated_but_not_displayed')}
            </p>
          )}

          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-background border border-border mb-3">
            <Mail size={16} className="text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground truncate">
              {t('copy_emailed_to')} {email}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">{t('link_validity')}</p>
        </div>
      </div>
    </div>
  );
}
