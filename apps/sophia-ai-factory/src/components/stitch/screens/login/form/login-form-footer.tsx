'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { SocialAuthButtons } from './social-auth-buttons';

export function LoginErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      id="login-error"
      className="mb-5 rounded-lg bg-rose-50 dark:bg-red-900/20 border border-rose-200 dark:border-red-800/30 px-4 py-3 text-sm text-rose-600 dark:text-red-400 flex items-center gap-2"
    >
      <span aria-hidden="true" className="text-rose-500 dark:text-red-400/70">&#9888;</span>
      <span>{error}</span>
    </div>
  );
}

export function LoginFormFooter({
  onPasskey,
  passkeyLoading,
  onSendOtp,
  otpSending,
}: {
  onPasskey: () => void;
  passkeyLoading: boolean;
  onSendOtp: () => void;
  otpSending: boolean;
}) {
  const t = useTranslations('stitch.auth.login');

  return (
    <>
      <div className="relative my-8" role="separator" aria-orientation="horizontal">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E2E8F0] dark:border-white/[0.08]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white dark:bg-[#11131F] px-3 text-slate-500 dark:text-zinc-400 font-medium tracking-wider">
            {t('orContinueWith')}
          </span>
        </div>
      </div>

      <SocialAuthButtons
        onPasskey={onPasskey}
        passkeyLoading={passkeyLoading}
        onSendOtp={onSendOtp}
        otpSending={otpSending}
      />

      <p className="text-center text-sm text-slate-600 dark:text-zinc-400">
        {t('noAccount')}{' '}
        <Link
          href="/register"
          className="text-[#4338CA] dark:text-[#6366F1] hover:opacity-80 font-semibold transition-opacity"
        >
          {t('signUp')}
        </Link>
      </p>
    </>
  );
}
