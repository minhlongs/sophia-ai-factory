'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname, Link } from '@/navigation';
import { authClient } from '@/seed/auth/better-auth-client';
import { Eye, EyeOff, Mail, Lock, Globe, Loader2 } from 'lucide-react';

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
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
        router.push(redirectTo || '/dashboard');
      }
    } catch {
      setError(t('networkError'));
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError(t('networkError') || 'Please enter your email address first');
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
      {/* Locale toggle */}
      <button
        type="button"
        onClick={switchLocale}
        className="fixed top-4 right-4 z-20 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded-md px-2 py-1.5 hover:bg-zinc-800/50"
        aria-label={locale === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang tiếng Anh'}
      >
        <Globe className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="font-medium uppercase tracking-wider">
          {locale === 'en' ? 'VI' : 'EN'}
        </span>
      </button>

      {/* Error banner */}
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
        {/* Email field */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-sm font-medium text-zinc-300"
          >
            {t('emailLabel')}
          </label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 pl-10 pr-3 rounded-lg border border-zinc-700 bg-[#0F0F11] text-zinc-100 text-sm placeholder-zinc-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
              required
              aria-required="true"
              aria-describedby={error ? 'login-error' : undefined}
              aria-invalid={error ? true : undefined}
            />
          </div>
        </div>

        {/* Password field */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label
              htmlFor="password"
              className="text-sm font-medium text-zinc-300"
            >
              {t('passwordLabel')}
            </label>
            <Link
              href="/reset-password"
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              {t('forgotPassword')}
            </Link>
          </div>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 pl-10 pr-10 rounded-lg border border-zinc-700 bg-[#0F0F11] text-zinc-100 text-sm placeholder-zinc-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
              required
              aria-required="true"
              aria-describedby={error ? 'login-error' : undefined}
              aria-invalid={error ? true : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors rounded-sm p-0.5"
              aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Submit button — Stitch indigo primary */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 inline-flex items-center justify-center rounded-lg bg-primary text-white text-sm font-medium transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]"
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

      {/* Divider */}
      <div className="relative my-8" role="separator" aria-orientation="horizontal">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#18181B] px-3 text-zinc-500 font-medium tracking-wider">
            {t('orContinueWith')}
          </span>
        </div>
      </div>

      {/* Social buttons — ghost with border */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <button
          type="button"
          disabled
          title={t('ssoComingSoon')}
          className="inline-flex items-center justify-center gap-2 h-11 rounded-lg border border-zinc-700 bg-transparent text-zinc-300 text-sm font-medium transition-colors hover:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:pointer-events-none disabled:opacity-50"
          aria-label={t('googleSignIn')}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true" role="img">
            <title>Google</title>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span className="hidden sm:inline">{t('googleSignIn')}</span>
        </button>

        <button
          type="button"
          onClick={handleMagicLink}
          disabled={magicLinkLoading}
          className="inline-flex items-center justify-center gap-2 h-11 rounded-lg border border-zinc-700 bg-transparent text-zinc-300 text-sm font-medium transition-colors hover:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-primary/60 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Magic Link"
        >
          {magicLinkLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
              role="img"
            >
              <title>Magic Link</title>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          )}
          <span className="hidden sm:inline">Magic Link</span>
        </button>
      </div>

      {/* Sign up link */}
      <p className="text-center text-sm text-zinc-400">
        {t('noAccount')}{' '}
        <Link
          href="/auth/signup"
          className="text-primary hover:text-primary/80 font-medium transition-colors"
        >
          {t('signUp')}
        </Link>
      </p>
    </>
  );
}
