'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, KeyRound } from 'lucide-react';

interface EmailOtpPanelProps {
  otpCode: string;
  setOtpCode: (val: string) => void;
  onVerifyOtp: () => void;
  otpVerifying: boolean;
}

export function EmailOtpPanel({
  otpCode,
  setOtpCode,
  onVerifyOtp,
  otpVerifying,
}: EmailOtpPanelProps) {
  const t = useTranslations('stitch.auth.login');

  return (
    <div className="mb-6 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-3">
      <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
        {t('emailOtpSentNotice')}
      </p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <KeyRound
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="email-otp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder={t('emailOtpPlaceholder')}
            aria-label={t('emailOtpLabel')}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full h-[40px] pl-9 pr-3 rounded-lg border border-indigo-200 dark:border-white/[0.12] bg-white dark:bg-[#090A10] text-[#0B0F19] dark:text-white text-sm font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onVerifyOtp}
          disabled={otpVerifying}
          aria-label={t('emailOtpVerify')}
          className="h-[40px] px-4 inline-flex items-center justify-center rounded-lg bg-[#4338CA] dark:bg-[#6366F1] text-white text-xs font-semibold transition-all hover:brightness-110 disabled:opacity-50"
        >
          {otpVerifying ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            t('emailOtpVerify')
          )}
        </button>
      </div>
    </div>
  );
}
