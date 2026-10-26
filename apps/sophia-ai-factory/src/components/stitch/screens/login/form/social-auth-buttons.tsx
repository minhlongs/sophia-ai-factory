import React from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Fingerprint, ShieldCheck } from 'lucide-react';

interface SocialAuthButtonsProps {
  onPasskey: () => void;
  passkeyLoading: boolean;
  onSendOtp: () => void;
  otpSending: boolean;
}

export function SocialAuthButtons({
  onPasskey,
  passkeyLoading,
  onSendOtp,
  otpSending,
}: SocialAuthButtonsProps) {
  const t = useTranslations('stitch.auth.login');

  return (
    <div className="grid grid-cols-2 gap-3 mb-8">
      <button
        type="button"
        onClick={onPasskey}
        disabled={passkeyLoading}
        className="inline-flex items-center justify-center gap-2 h-[44px] rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-transparent text-[#0B0F19] dark:text-white text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary disabled:pointer-events-none disabled:opacity-50"
        aria-label={t('passkeySignIn')}
      >
        {passkeyLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#4338CA] dark:text-[#6366F1]" aria-hidden="true" />
        ) : (
          <Fingerprint className="w-4 h-4 shrink-0 text-[#4338CA] dark:text-[#6366F1]" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{t('passkeySignIn')}</span>
      </button>

      <button
        type="button"
        onClick={onSendOtp}
        disabled={otpSending}
        className="inline-flex items-center justify-center gap-2 h-[44px] rounded-lg border border-[#E2E8F0] dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-transparent text-[#0B0F19] dark:text-white text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary disabled:pointer-events-none disabled:opacity-50"
        aria-label={t('emailOtpSend')}
      >
        {otpSending ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#4338CA] dark:text-[#6366F1]" aria-hidden="true" />
        ) : (
          <ShieldCheck className="w-4 h-4 shrink-0 text-[#4338CA] dark:text-[#6366F1]" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{t('emailOtpSend')}</span>
      </button>
    </div>
  );
}
