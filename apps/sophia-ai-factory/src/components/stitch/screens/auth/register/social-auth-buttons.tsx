'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Fingerprint, ShieldCheck, Loader2 } from 'lucide-react';

export interface SocialAuthButtonsProps {
  onPasskey?: () => void;
  passkeyLoading?: boolean;
  onSendOtp?: () => void;
  otpSending?: boolean;
}

export function SocialAuthButtons({
  onPasskey,
  passkeyLoading = false,
  onSendOtp,
  otpSending = false,
}: SocialAuthButtonsProps) {
  const t = useTranslations('stitch.auth.login');

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onPasskey}
        disabled={passkeyLoading || !onPasskey}
        className="inline-flex items-center justify-center gap-2 h-[42px] rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-transparent text-[#0B0F19] dark:text-white text-xs font-semibold transition-all hover:bg-slate-100 dark:hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        aria-label={t('passkeySignIn')}
      >
        {passkeyLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#4338CA] dark:text-[#6366F1]" aria-hidden="true" />
        ) : (
          <Fingerprint className="w-4 h-4 shrink-0 text-[#4338CA] dark:text-[#6366F1]" aria-hidden="true" />
        )}
        <span>{t('passkeySignIn')}</span>
      </button>

      <button
        type="button"
        onClick={onSendOtp}
        disabled={otpSending || !onSendOtp}
        className="inline-flex items-center justify-center gap-2 h-[42px] rounded-xl border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-transparent text-[#0B0F19] dark:text-white text-xs font-semibold transition-all hover:bg-slate-100 dark:hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        aria-label={t('emailOtpSend')}
      >
        {otpSending ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#4338CA] dark:text-[#6366F1]" aria-hidden="true" />
        ) : (
          <ShieldCheck className="w-4 h-4 shrink-0 text-[#4338CA] dark:text-[#6366F1]" aria-hidden="true" />
        )}
        <span>{t('emailOtpSend')}</span>
      </button>
    </div>
  );
}
