'use client';

/**
 * RegisterPageView — stitch split-screen registration layout
 *
 * Layer: components/stitch/screens/auth/register
 */

import React, { useState } from 'react';
import { useRouter, usePathname, Link } from '@/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { authClient } from '@/seed/auth/better-auth-client';
import type { RegisterFormState, RegisterStep } from './types';
import { RegisterSuccessView } from './register-success-view';
import { RegisterHeader } from './register-header';
import { RegisterForm } from './register-form';
import { SocialAuthButtons } from './social-auth-buttons';

export function RegisterPageView() {
  const t = useTranslations('stitch.auth.register');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [step, setStep] = useState<RegisterStep>('form');
  const [formState, setFormState] = useState<RegisterFormState>({
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchLocale = () => {
    const nextLocale = locale === 'en' ? 'vi' : 'en';
    router.replace(pathname, { locale: nextLocale });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { password, confirmPassword, companyName, email } = formState;

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
          <RegisterSuccessView />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#12141F]/90 p-8 md:p-10 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl transition-all duration-500">
            <RegisterHeader error={error} />

            <RegisterForm
              formState={formState}
              setFormState={setFormState}
              onSubmit={handleSubmit}
              loading={loading}
            />

            {/* Divider */}
            <div className="relative flex items-center my-6">
              <div className="flex-grow border-t border-white/[0.08]" />
              <span className="flex-shrink mx-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                {t('or')}
              </span>
              <div className="flex-grow border-t border-white/[0.08]" />
            </div>

            <SocialAuthButtons />

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
