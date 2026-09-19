'use client';

import React, { useState } from 'react';
import { useRouter, usePathname, Link } from '@/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Mail, Lock, User, CheckCircle, Globe, Sparkles, ArrowRight } from 'lucide-react';
import { authClient } from '@/seed/auth/better-auth-client';
import { Button } from '@/components/stitch';

export default function RegisterPage() {
  const t = useTranslations('stitch.auth.register');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [step, setStep] = useState<'form' | 'success'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchLocale = () => {
    const nextLocale = locale === 'en' ? 'vi' : 'en';
    router.replace(pathname, { locale: nextLocale });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('errorPasswordMismatch') || 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError(t('errorPasswordTooShort') || 'Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError(t('errorPasswordUppercase') || 'Password must include at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError(t('errorPasswordLowercase') || 'Password must include at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError(t('errorPasswordNumber') || 'Password must include at least one number');
      return;
    }

    setLoading(true);
    try {
      const resolvedName = companyName.trim() || email.split('@')[0].trim() || 'user';
      const result = await authClient.signUp.email({
        name: resolvedName,
        email,
        password,
        callbackURL: '/dashboard/onboarding',
      });

      if (result.error) {
        const code = (result.error as { code?: string }).code?.toLowerCase() ?? '';
        const msg = result.error.message?.toLowerCase() ?? '';
        const status = (result.error as { status?: number }).status ?? 0;

        if (code === 'user_already_exists' || code === 'email_already_exists' || msg.includes('already') || msg.includes('exist') || msg.includes('duplicate')) {
          setError(t('errorEmailExists') || 'An account with this email already exists');
        } else if (code === 'password_too_short' || code === 'invalid_password' || code === 'weak_password' || msg.includes('password')) {
          setError(t('errorPasswordComplexity') || 'Password must be at least 8 characters with uppercase, lowercase, and a number');
        } else if (status === 429) {
          setError(t('errorRateLimited') || 'Too many attempts. Please wait a moment and try again.');
        } else if (status === 503) {
          setError(t('errorServiceUnavailable') || 'Registration is temporarily unavailable. Please try again later.');
        } else {
          setError(t('errorGeneric') || 'Registration failed. Please try again.');
        }
        return;
      }

      setStep('success');
    } catch {
      setError(t('errorGeneric') || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-[#08090D] p-6 antialiased relative"
      data-testid="register-page"
    >
      {/* Locale Toggle */}
      <button
        type="button"
        onClick={switchLocale}
        className="fixed top-4 right-4 z-20 flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors rounded-full px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08]"
        aria-label="Toggle language"
      >
        <Globe className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
        <span className="font-semibold uppercase tracking-wider">
          {locale === 'en' ? 'VI' : 'EN'}
        </span>
      </button>

      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-[10%] -left-[10%] w-[45%] h-[45%] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[45%] h-[45%] bg-purple-600/10 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-[460px] relative z-10">
        {step === 'success' ? (
          <div className="rounded-2xl border border-white/10 bg-[#12141F]/90 p-8 md:p-10 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl text-center space-y-6">
            <div className="inline-flex items-center justify-center">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight mb-2 font-display">
                {t('successTitle')}
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                {t('successMessage')}
              </p>
            </div>
            <div className="pt-2 space-y-3">
              <Link
                href="/setup"
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition-all"
              >
                <span>{t('startSetup')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="w-full inline-flex items-center justify-center py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-200 font-semibold text-sm transition-all"
              >
                {t('goToLogin')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#12141F]/90 p-8 md:p-10 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl transition-all duration-500">
            {/* Brand Logo & Header */}
            <div className="flex flex-col items-center mb-8 text-center">
              <div className="w-12 h-12 mb-5 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/25">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mb-1 font-display">
                {t('title')}
              </h1>
              <p className="text-sm text-slate-400">
                {t('subtitle')}
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-300 flex items-center gap-2.5"
              >
                <span className="text-rose-400 font-bold">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Registration Form */}
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              {/* Company Name */}
              <div>
                <label htmlFor="company" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  {t('companyLabel')}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="company"
                    type="text"
                    placeholder={t('companyPlaceholder')}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#08090D]/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  {t('emailLabel')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#08090D]/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  {t('passwordLabel')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="password"
                    type="password"
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#08090D]/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  {t('confirmPasswordLabel')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder={t('confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#08090D]/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start pt-1">
                <input
                  id="terms"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  required
                  className="w-4 h-4 mt-0.5 rounded border-white/20 bg-[#08090D] text-indigo-600 focus:ring-indigo-500/30"
                />
                <label htmlFor="terms" className="ml-2.5 text-xs text-slate-400 leading-normal select-none">
                  {t('termsPrefix')}{' '}
                  <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 underline">
                    {t('termsLink')}
                  </Link>
                  {' '}{t('and')}{' '}
                  <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline">
                    {t('privacyLink')}
                  </Link>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button type="submit" fullWidth loading={loading} className="h-12 text-base font-bold shadow-xl shadow-indigo-500/25">
                  {t('submit')}
                </Button>
              </div>
            </form>

            {/* Divider */}
            <div className="relative flex items-center my-6">
              <div className="flex-grow border-t border-white/[0.08]" />
              <span className="flex-shrink mx-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                {t('or')}
              </span>
              <div className="flex-grow border-t border-white/[0.08]" />
            </div>

            {/* Social SSO Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" type="button" disabled title={t('ssoComingSoon')}>
                <svg className="w-4 h-4 mr-2 opacity-50" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-xs">{t('googleSignIn')}</span>
              </Button>
              <Button variant="outline" type="button" disabled title={t('ssoComingSoon')}>
                <svg className="w-4 h-4 mr-2 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.522 11.522 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                <span className="text-xs">{t('githubSignIn')}</span>
              </Button>
            </div>

            {/* Switch to Login Link */}
            <p className="text-center mt-6 text-xs text-slate-400">
              {t('hasAccount')}{' '}
              <Link href="/login" className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors">
                {t('signIn')}
              </Link>
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Sophia AI Factory. All rights reserved.
        </p>
      </div>
    </main>
  );
}
