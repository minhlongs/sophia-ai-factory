'use client';

import React, { useState } from 'react';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import { Mail, Lock, User, CheckCircle } from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader } from '@/components/stitch';
import { authClient } from '@/seed/auth/better-auth-client';

export default function RegisterPage() {
  const t = useTranslations('stitch.auth.register');

  const [step, setStep] = useState<'form' | 'success'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    // Password complexity must match server-side validate() in better-auth-server.ts
    // (M10 fix — 2026-07-01). Check BEFORE submitting to avoid confusing English
    // server error messages reaching the user.
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
      const result = await authClient.signUp.email({
        name: companyName,
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

  if (step === 'success') {
    return (
      <main className="min-h-screen flex items-center justify-center p-md bg-background relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]" />
        </div>

        <Card className="w-full max-w-[440px] relative z-10 text-center" padding="xl">
          <div className="inline-flex items-center justify-center mb-md">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
          <CardHeader className="!p-0">
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-sm">
              {t('successTitle')}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t('successMessage')}
            </p>
          </CardHeader>
          <CardContent className="!p-0 mt-xl">
            <Button fullWidth href="/login">
              {t('goToLogin')}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-md bg-background overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]" />
      </div>

      <Card className="w-full max-w-[440px] relative z-10" padding="xl">
        <CardHeader className="text-center mb-xl">
          <div className="inline-flex items-center justify-center mb-md">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <svg className="w-6 h-6 text-on-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
              </svg>
            </div>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">
            {t('title')}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
            {t('subtitle')}
          </p>
        </CardHeader>

        <form className="space-y-lg" onSubmit={handleSubmit}>
          {/* Error banner */}
          {error && (
            <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Company Name */}
          <div className="space-y-sm">
            <label htmlFor="company" className="font-label-md text-label-md text-on-surface">
              {t('companyLabel')}
            </label>
            <Input
              id="company"
              type="text"
              placeholder={t('companyPlaceholder')}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              prefix={<User className="w-5 h-5" />}
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-sm">
            <label htmlFor="email" className="font-label-md text-label-md text-on-surface">
              {t('emailLabel')}
            </label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              prefix={<Mail className="w-5 h-5" />}
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-sm">
            <label htmlFor="password" className="font-label-md text-label-md text-on-surface">
              {t('passwordLabel')}
            </label>
            <Input
              id="password"
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              prefix={<Lock className="w-5 h-5" />}
              required
            />
          </div>

          {/* Confirm Password */}
          <div className="space-y-sm">
            <label htmlFor="confirmPassword" className="font-label-md text-label-md text-on-surface">
              {t('confirmPasswordLabel')}
            </label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t('confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              prefix={<Lock className="w-5 h-5" />}
              required
            />
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start">
            <input
              id="terms"
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-primary bg-surface border-outline-variant rounded focus:ring-primary/20"
              required
            />
            <label htmlFor="terms" className="ml-sm font-body-sm text-body-sm text-on-surface-variant select-none">
              {t('termsPrefix')}{' '}
              <Link href="/terms" className="text-primary hover:underline">
                {t('termsLink')}
              </Link>
              {' '}{t('and')}{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                {t('privacyLink')}
              </Link>
            </label>
          </div>

          {/* Submit Button */}
          <Button type="submit" fullWidth loading={loading} className="h-12">
            {t('submit')}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center my-xl">
          <div className="flex-grow border-t border-outline-variant" />
          <span className="flex-shrink mx-md font-label-sm text-label-sm text-outline uppercase tracking-widest">
            {t('or')}
          </span>
          <div className="flex-grow border-t border-outline-variant" />
        </div>

        {/* SSO Buttons — social providers are not yet configured server-side.
             Buttons are rendered disabled with a coming-soon hint until
             Better Auth social provider setup is completed. */}
        <div className="grid grid-cols-2 gap-md">
          <Button variant="outline" type="button" disabled title={t('ssoComingSoon')}>
            <svg className="w-5 h-5 mr-2 opacity-50" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t('googleSignIn')}
          </Button>
          <Button variant="outline" type="button" disabled title={t('ssoComingSoon')}>
            <svg className="w-5 h-5 mr-2 opacity-50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.522 11.522 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            {t('githubSignIn')}
          </Button>
        </div>

        {/* Sign In Link */}
        <p className="text-center mt-xl font-body-sm text-body-sm text-on-surface-variant">
          {t('hasAccount')}{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            {t('signIn')}
          </Link>
        </p>
      </Card>
    </main>
  );
}
