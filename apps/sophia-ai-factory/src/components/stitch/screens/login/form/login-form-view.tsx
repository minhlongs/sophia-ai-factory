import React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';
import { Loader2 } from 'lucide-react';
import type { LoginFormProps } from './types';
import { PasswordInputField } from './password-input-field';
import { LoginLocaleSwitcher, LoginEmailField } from './login-email-field';
import { LoginErrorBanner, LoginFormFooter } from './login-form-footer';
import { EmailOtpPanel } from './email-otp-panel';
import { useAuth2027State } from './use-auth-2027-state';

export { LoginErrorBanner, LoginFormFooter };

export function LoginFormView({ redirectTo }: LoginFormProps) {
  const t = useTranslations('stitch.auth.login');
  const tCommon = useTranslations('stitch.common');
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const state = useAuth2027State({ redirectTo });

  return (
    <>
      <LoginLocaleSwitcher
        locale={locale}
        onSwitch={() => router.replace(pathname, { locale: locale === 'en' ? 'vi' : 'en' })}
      />
      <LoginErrorBanner error={state.error} />
      {state.otpSent && (
        <EmailOtpPanel
          otpCode={state.otpCode}
          setOtpCode={state.setOtpCode}
          onVerifyOtp={state.handleVerifyOtp}
          otpVerifying={state.otpVerifying}
        />
      )}
      <form onSubmit={state.handleSubmit} className="space-y-5" noValidate>
        <LoginEmailField email={state.email} setEmail={state.setEmail} error={state.error} />
        <PasswordInputField
          password={state.password}
          setPassword={state.setPassword}
          showPassword={state.showPassword}
          setShowPassword={state.setShowPassword}
          error={state.error}
        />
        <button
          type="submit"
          disabled={state.loading}
          className="w-full h-[44px] inline-flex items-center justify-center rounded-lg bg-[#4338CA] dark:bg-[#6366F1] text-white text-[15px] font-semibold transition-all hover:brightness-110 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary shadow-lg shadow-[#4338CA]/20 disabled:pointer-events-none disabled:opacity-50"
          aria-label={t('submit')}
        >
          {state.loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{tCommon('loading')}</span>
            </span>
          ) : (
            t('submit')
          )}
        </button>
      </form>
      <LoginFormFooter
        onPasskey={state.handlePasskey}
        passkeyLoading={state.passkeyLoading}
        onSendOtp={state.handleSendOtp}
        otpSending={state.otpSending}
      />
    </>
  );
}
