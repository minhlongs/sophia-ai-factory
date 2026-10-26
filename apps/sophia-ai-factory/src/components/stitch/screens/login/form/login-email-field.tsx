'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Mail, Globe } from 'lucide-react';

export function LoginLocaleSwitcher({
  locale,
  onSwitch,
}: {
  locale: string;
  onSwitch: () => void;
}) {
  const t = useTranslations('stitch.auth.login');

  return (
    <button
      type="button"
      onClick={onSwitch}
      className="fixed top-4 right-4 z-20 flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 hover:text-[#0B0F19] dark:hover:text-zinc-200 transition-colors rounded-md px-2.5 py-1.5 bg-white dark:bg-[#11131F] border border-[#E2E8F0] dark:border-white/[0.08] shadow-sm"
      aria-label={locale === 'en' ? t('switchToVietnamese') : t('switchToEnglish')}
    >
      <Globe className="w-3.5 h-3.5 text-[#4338CA] dark:text-[#6366F1]" aria-hidden="true" />
      <span className="font-medium uppercase tracking-wider">
        {locale === 'en' ? 'VI' : 'EN'}
      </span>
    </button>
  );
}

export function LoginEmailField({
  email,
  setEmail,
  error,
}: {
  email: string;
  setEmail: (val: string) => void;
  error: string | null;
}) {
  const t = useTranslations('stitch.auth.login');

  return (
    <div className="space-y-1.5">
      <label htmlFor="email" className="text-[13px] font-medium text-slate-700 dark:text-[#A1A1AA]">
        {t('emailLabel')}
      </label>
      <div className="relative group">
        <Mail
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          id="email"
          type="email"
          autoComplete="username webauthn"
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-[44px] pl-10 pr-4 rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10] text-[#0B0F19] dark:text-white text-sm placeholder-slate-400 dark:placeholder-zinc-500 transition-all focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:cursor-not-allowed disabled:opacity-50"
          required
          aria-required="true"
          aria-describedby={error ? 'login-error' : undefined}
          aria-invalid={error ? true : undefined}
        />
      </div>
    </div>
  );
}
