import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/navigation';
import { authClient } from '@/seed/auth/better-auth-client';
import { Loader2 } from 'lucide-react';
import type { LoginFormProps } from './types';
import { PasswordInputField } from './password-input-field';
import { LoginLocaleSwitcher, LoginEmailField } from './login-email-field';
import { LoginErrorBanner, LoginFormFooter } from './login-form-footer';

export { LoginErrorBanner, LoginFormFooter };

export function LoginFormView({ redirectTo }: LoginFormProps) {
  const t = useTranslations('stitch.auth.login');
  const tCommon = useTranslations('stitch.common');
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError(t('emailRequired'));
      return;
    }
    if (!password) {
      setError(t('invalidCredentials'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email: cleanEmail, password });
      if (result.error) {
        setError(t('invalidCredentials'));
        setLoading(false);
      } else {
        let target = redirectTo && !redirectTo.startsWith('/api/') ? redirectTo : '/dashboard';
        target = target.replace(/^\/(?:en|vi)(?=\/|$)/, '') || '/dashboard';
        router.push(target);
      }
    } catch {
      setError(t('networkError'));
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError(t('emailRequired'));
      return;
    }
    setMagicLinkLoading(true);
    setError(null);
    try {
      const result = await authClient.signIn.magicLink({ email: cleanEmail });
      if (result.error) {
        setError(result.error.message || t('networkError'));
      }
      setMagicLinkLoading(false);
    } catch {
      setError(t('networkError'));
      setMagicLinkLoading(false);
    }
  };

  const switchLocale = () => {
    const newLocale = locale === 'en' ? 'vi' : 'en';
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <>
      <LoginLocaleSwitcher locale={locale} onSwitch={switchLocale} />

      <LoginErrorBanner error={error} />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <LoginEmailField email={email} setEmail={setEmail} error={error} />

        <PasswordInputField
          password={password}
          setPassword={setPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          error={error}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full h-[44px] inline-flex items-center justify-center rounded-lg bg-[#4338CA] dark:bg-[#6366F1] text-white text-[15px] font-semibold transition-all hover:brightness-110 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#11131F] shadow-lg shadow-[#4338CA]/20 dark:shadow-primary/20 disabled:pointer-events-none disabled:opacity-50"
          aria-label={t('submit')}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{tCommon('loading')}</span>
            </span>
          ) : (
            t('submit')
          )}
        </button>
      </form>

      <LoginFormFooter onMagicLink={handleMagicLink} magicLinkLoading={magicLinkLoading} />
    </>
  );
}
