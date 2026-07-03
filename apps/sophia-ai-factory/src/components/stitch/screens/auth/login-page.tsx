'use client';

import React, { useState } from 'react';
import { Link, useRouter, usePathname } from '@/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Eye, EyeOff, Mail, Lock, Globe } from 'lucide-react';
import { authClient } from '@/seed/auth/better-auth-client';

export default function LoginPage({ redirectTo }: { redirectTo?: string }) {
  const t = useTranslations('stitch.auth.login');
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
        setError(t('invalidCredentials') || 'Invalid email or password');
        setLoading(false);
      } else {
        router.push(redirectTo || '/dashboard');
      }
    } catch {
      setError(t('networkError') || 'Network error. Please try again.');
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
        setError(result.error.message || t('networkError') || 'Failed to send magic link');
      }
      setMagicLinkLoading(false);
    } catch {
      setError(t('networkError') || 'Network error. Please try again.');
      setMagicLinkLoading(false);
    }
  };

  const switchLocale = () => {
    const newLocale = locale === 'en' ? 'vi' : 'en';
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F0F11] px-4 py-8">
      {/* Language toggle */}
      <button
        type="button"
        onClick={switchLocale}
        className="fixed top-4 right-4 z-20 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="font-medium uppercase tracking-wider">{locale === 'en' ? 'vi' : 'en'}</span>
      </button>

      {/* Login card */}
      <div className="w-full max-w-[440px]">
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-6">
          {/* Logo & heading */}
          <div className="text-center mb-7">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Sophia<span className="text-[#6366F1]">.</span>
            </h1>
            <p className="mt-5 text-lg font-semibold text-white">
              {t('title')}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {t('subtitle')}
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                {t('emailLabel')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0F0F11] border border-zinc-700 rounded-lg py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                  {t('passwordLabel')}
                </label>
                <Link
                  href="/reset-password"
                  className="text-xs text-[#6366F1] hover:text-indigo-400 transition-colors"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0F0F11] border border-zinc-700 rounded-lg py-2.5 pl-10 pr-10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign In button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6366F1] hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-2 focus:ring-offset-[#18181B]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                t('submit')
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center my-6">
            <div className="flex-grow border-t border-zinc-700" />
            <span className="flex-shrink mx-3 text-xs text-zinc-500 uppercase tracking-wider">
              {t('orContinueWith')}
            </span>
            <div className="flex-grow border-t border-zinc-700" />
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled
              title={t('ssoComingSoon')}
              className="inline-flex items-center justify-center gap-2 bg-transparent border border-zinc-700 text-zinc-500 text-sm rounded-lg py-2.5 opacity-50 cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t('googleSignIn')}
            </button>
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={magicLinkLoading}
              className="inline-flex items-center justify-center gap-2 bg-transparent border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm rounded-lg py-2.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {magicLinkLoading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              )}
              Magic Link
            </button>
          </div>

          {/* Sign up link */}
          <p className="text-center mt-6 text-sm text-zinc-400">
            {t('noAccount')}{' '}
            <Link href="/login?tab=signup" className="text-[#6366F1] hover:text-indigo-400 font-medium transition-colors">
              {t('signUp')}
            </Link>
          </p>
        </div>

        {/* Copyright */}
        <p className="mt-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} Sophia AI Factory. All rights reserved.
        </p>
      </div>
    </div>
  );
}
