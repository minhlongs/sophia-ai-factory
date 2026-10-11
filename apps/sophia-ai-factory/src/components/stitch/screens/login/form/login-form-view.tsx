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
        className="fixed top-4 right-4 z-20 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded-md px-2 py-1.5 hover:bg-zinc-800/50"
        aria-label={locale === 'en' ? t('switchToVietnamese') : t('switchToEnglish')}
      >
        <Globe className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="font-medium uppercase tracking-wider">
          {locale === 'en' ? 'VI' : 'EN'}
        </span>
      </button>

      {error && (
        <div
          role="alert"
          id="login-error"
          className="mb-5 rounded-lg bg-red-900/20 border border-red-800/30 px-4 py-3 text-sm text-red-400 flex items-center gap-2"
        >
          <span aria-hidden="true" className="text-red-400/70">&#9888;</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-[13px] font-medium text-[#A1A1AA]">
            {t('emailLabel')}
          </label>
          <div className="relative group">
            <Mail
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-[44px] pl-10 pr-4 rounded-lg border border-zinc-700 bg-[#0F0F11] text-white text-sm placeholder-zinc-600 transition-all focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
          className="w-full h-[44px] inline-flex items-center justify-center rounded-lg bg-primary text-white text-[15px] font-semibold transition-all hover:brightness-110 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#0F0F11] shadow-lg shadow-primary/20 disabled:pointer-events-none disabled:opacity-50"
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
          <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#18181B] px-3 text-zinc-400 font-medium tracking-wider">
            {t('orContinueWith')}
          </span>
        </div>
      </div>

      <SocialAuthButtons onMagicLink={handleMagicLink} magicLinkLoading={magicLinkLoading} />

      <p className="text-center text-sm text-zinc-400">
        {t('noAccount')}{' '}
        <Link
          href="/register"
          className="text-primary hover:opacity-80 font-medium transition-opacity"
        >
          {t('signUp')}
        </Link>
      </p>
    </>
  );
}
