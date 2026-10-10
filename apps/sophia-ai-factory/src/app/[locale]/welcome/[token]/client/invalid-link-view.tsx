'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle, Mail, Loader2 } from 'lucide-react';
import type { InvalidLinkViewProps } from './types';

export function InvalidLinkView({ locale, message }: InvalidLinkViewProps) {
  const t = useTranslations('welcome');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResendError(null);
    try {
      const res = await fetch('/api/welcome/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.status === 429) {
        setResendError(t('invalid.rateLimited'));
        return;
      }
      if (!res.ok) {
        setResendError(t('invalid.genericError'));
        return;
      }
      setSent(true);
    } catch {
      setResendError(t('invalid.connectionError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div aria-live="polite" className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-900/30 border border-emerald-500/40 flex items-center justify-center mx-auto">
            <CheckCircle2 aria-hidden="true" size={28} className="text-emerald-300" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {t('invalid.sentTitle')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('invalid.sentDescription')}
          </p>
          <a
            href={`/${locale}`}
            className="inline-block px-6 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-500 transition-colors"
          >
            {t('invalid.backHome')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-card backdrop-blur border border-red-500/30 rounded-2xl p-8 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-500/40 flex items-center justify-center mx-auto">
              <AlertTriangle aria-hidden="true" size={26} className="text-red-300" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {t('invalid.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {message ?? t('invalid.defaultMessage')}
            </p>
          </div>

          <div className="border-t border-border pt-5 space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              {t('invalid.resendPrompt')}
            </p>
            <form onSubmit={handleResend} className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-background border border-border focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-violet-500/40">
                <Mail aria-hidden="true" size={16} className="text-muted-foreground flex-shrink-0" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  placeholder="email@congty.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder-zinc-600 focus:outline-none text-sm"
                  maxLength={200}
                />
              </div>

              {resendError && (
                <p role="alert" aria-live="polite" className="text-xs text-red-300 text-center">{resendError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none"
              >
                {submitting ? <Loader2 aria-hidden="true" size={16} className="animate-spin" /> : null}
                {t('invalid.submit')}
              </button>
            </form>
          </div>

          <a
            href={`/${locale}/login`}
            className="block text-center text-xs text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            {t('invalid.altLogin')}
          </a>
        </div>
      </div>
    </div>
  );
}
