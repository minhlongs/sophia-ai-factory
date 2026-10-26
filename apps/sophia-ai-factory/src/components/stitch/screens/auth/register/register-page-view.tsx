'use client';

/**
 * RegisterPageView — stitch split-screen registration layout (Auth 2027)
 *
 * Layer: components/stitch/screens/auth/register
 */

import React from 'react';
import { useRouter, usePathname, Link } from '@/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { RegisterSuccessView } from './register-success-view';
import { RegisterHeader } from './register-header';
import { RegisterForm } from './register-form';
import { SocialAuthButtons } from './social-auth-buttons';
import { EmailOtpPanel } from '@/components/stitch/screens/login/form/email-otp-panel';
import { mapRegisterAuthError, validateRegisterForm } from './register-validation';
import { useRegister2027State } from './use-register-2027-state';

export { validateRegisterForm, mapRegisterAuthError };

export function RegisterPageView() {
  const t = useTranslations('stitch.auth.register');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const state = useRegister2027State();

  const switchLocale = () => {
    router.replace(pathname, { locale: locale === 'en' ? 'vi' : 'en' });
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FC] dark:bg-[#090A10] text-[#0B0F19] dark:text-slate-100 p-6 antialiased relative transition-colors duration-300"
      data-testid="register-page"
    >
      <button
        type="button"
        onClick={switchLocale}
        className="fixed top-4 right-4 z-20 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-[#0B0F19] dark:hover:text-white transition-colors rounded-full px-3 py-1.5 bg-white dark:bg-[#11131F] hover:bg-slate-50 dark:hover:bg-white/[0.1] border border-[#E2E8F0] dark:border-white/[0.08] shadow-sm"
        aria-label={locale === 'en' ? 'Switch language' : 'Đổi ngôn ngữ'}
      >
        <Globe className="w-3.5 h-3.5 text-primary dark:text-primary-400" aria-hidden="true" />
        <span className="font-semibold uppercase tracking-wider">{locale === 'en' ? 'VI' : 'EN'}</span>
      </button>

      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[10%] -left-[10%] w-[45%] h-[45%] bg-primary/8 dark:bg-primary/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[45%] h-[45%] bg-[#D97706]/8 dark:bg-[#F59E0B]/10 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-[460px] relative z-10">
        {state.step === 'success' ? (
          <RegisterSuccessView />
        ) : (
          <div className="rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F] p-8 md:p-10 shadow-xl dark:shadow-2xl transition-all duration-500">
            <RegisterHeader error={state.error} />
            {state.otpSent && (
              <EmailOtpPanel
                otpCode={state.otpCode}
                setOtpCode={state.setOtpCode}
                onVerifyOtp={state.handleVerifyOtp}
                otpVerifying={state.otpVerifying}
              />
            )}
            <RegisterForm
              formState={state.formState}
              setFormState={state.setFormState}
              onSubmit={state.handleSubmit}
              loading={state.loading}
            />
            <div className="relative flex items-center my-6">
              <div className="flex-grow border-t border-[#E2E8F0] dark:border-white/[0.08]" />
              <span className="flex-shrink mx-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {t('or')}
              </span>
              <div className="flex-grow border-t border-[#E2E8F0] dark:border-white/[0.08]" />
            </div>
            <SocialAuthButtons
              onPasskey={state.handlePasskey}
              passkeyLoading={state.passkeyLoading}
              onSendOtp={state.handleSendOtp}
              otpSending={state.otpSending}
            />
            <p className="text-center mt-6 text-xs text-slate-600 dark:text-slate-400">
              {t('hasAccount')}{' '}
              <Link href="/login" className="text-primary dark:text-primary-400 font-semibold hover:opacity-80 dark:hover:text-primary-300 transition-colors">
                {t('signIn')}
              </Link>
            </p>
          </div>
        )}
        <p className="mt-8 text-center text-xs text-slate-500 dark:text-slate-500">
          &copy; {new Date().getFullYear()} Sophia AI Factory. All rights reserved.
        </p>
      </div>
    </main>
  );
}
