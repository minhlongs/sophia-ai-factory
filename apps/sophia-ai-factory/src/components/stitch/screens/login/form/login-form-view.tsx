import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname, Link } from '@/navigation';
import { authClient } from '@/seed/auth/better-auth-client';
import { Mail, Globe, Loader2 } from 'lucide-react';
import type { LoginFormProps } from './types';
import { PasswordInputField } from './password-input-field';
import { SocialAuthButtons } from './social-auth-buttons';

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
    setLoading(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email, password });
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
    if (!email) {
      setError(t('networkError'));
      return;
    }
    setMagicLinkLoading(true);
    setError(null);
    try {
      const result = await authClient.signIn.magicLink({ email });
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
      <button
        type="button"
        onClick={switchLocale}
        className="fixed top-4 right-4 z-20 flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 hover:text-[#0B0F19] dark:hover:text-zinc-200 transition-colors rounded-md px-2.5 py-1.5 bg-white dark:bg-[#11131F] border border-[#E2E8F0] dark:border-white/[0.08] shadow-sm"
        aria-label={locale === 'en' ? t('switchToVietnamese') : t('switchToEnglish')}
      >
        <Globe className="w-3.5 h-3.5 text-[#4338CA] dark:text-[#6366F1]" aria-hidden="true" />
        <span className="font-medium uppercase tracking-wider">
          {locale === 'en' ? 'VI' : 'EN'}
        </span>
      </button>

      {error && (
        <div
          role="alert"
          id="login-error"
          className="mb-5 rounded-lg bg-rose-50 dark:bg-red-900/20 border border-rose-200 dark:border-red-800/30 px-4 py-3 text-sm text-rose-600 dark:text-red-400 flex items-center gap-2"
        >
          <span aria-hidden="true" className="text-rose-500 dark:text-red-400/70">&#9888;</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
              autoComplete="email"
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

      <SocialAuthButtons onMagicLink={handleMagicLink} magicLinkLoading={magicLinkLoading} />

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
