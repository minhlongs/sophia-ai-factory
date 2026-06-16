'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { authClient } from '@/seed/auth/better-auth-client';
import PasswordLoginForm from '@/components/auth/PasswordLoginForm';
import MagicLinkForm from '@/components/auth/MagicLinkForm';
import { SignupForm } from '@/forest/components/auth/signup-form';
import { AuthModeProvider, useAuthMode } from '@/seed/contexts/auth-mode-context';
import { activateCouponAfterLoginAction } from '@/app/actions/auth';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const coupon = searchParams.get('coupon');
  const tier = searchParams.get('tier');
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const tSignup = useTranslations('auth.signup');
  const t = useTranslations('auth.login');

  const { pageTab, setPageTab, mode, setMode } = useAuthMode();

  const signupStrings = useMemo(() => ({
    name_label: tSignup('name_label'),
    name_placeholder: tSignup('name_placeholder'),
    email_label: tSignup('email_label'),
    email_placeholder: tSignup('email_placeholder'),
    password_label: tSignup('password_label'),
    password_placeholder: tSignup('password_placeholder'),
    confirm_label: tSignup('confirm_label'),
    confirm_placeholder: tSignup('confirm_placeholder'),
    submit: tSignup('submit'),
    submitting: tSignup('submitting'),
    success_title: tSignup('success_title'),
    success_message: tSignup('success_message'),
    error_password_mismatch: tSignup('error_password_mismatch'),
    error_password_too_short: tSignup('error_password_too_short'),
    error_email_exists: tSignup('error_email_exists'),
    error_generic: tSignup('error_generic'),
  }), [tSignup]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function handlePasswordLoginSuccess(): Promise<void> {
    if (coupon && tier) {
      const result = await activateCouponAfterLoginAction(coupon, tier);
      if (result.success) {
        router.push(`/dashboard?activated=${encodeURIComponent(tier)}`);
        router.refresh();
      } else {
        setError(result.message);
      }
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  }

  if (magicSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-16">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-400/10 flex items-center justify-center">
              <CheckCircle aria-hidden="true" className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t('check_email_title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('check_email_message', { email })}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {t('check_spam_note')}
            </p>
            <button
              type="button"
              onClick={() => { setMagicSent(false); setMode('password'); }}
              className="text-sm text-accent hover:text-accent transition-colors"
            >
              {t('back_to_login')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-16">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {pageTab === 'signin' ? t('sign_in') : t('create_account')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('tagline')}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm space-y-6">
          {/* Page tab: Sign In | Sign Up */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => { setPageTab('signin'); setError(null); setEmail(''); setPassword(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                pageTab === 'signin'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('tab_signin')}
            </button>
            <button
              type="button"
              onClick={() => { setPageTab('signup'); setError(null); setEmail(''); setPassword(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                pageTab === 'signup'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('tab_signup')}
            </button>
          </div>

          {pageTab === 'signup' ? (
            <SignupForm t={signupStrings} />
          ) : (
            <>
              {/* Sign-in mode toggle: password | magic link */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setMode('password'); setError(null); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    mode === 'password'
                      ? 'bg-primary/60 text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('mode_password')}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('magic'); setError(null); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    mode === 'magic'
                      ? 'bg-primary/60 text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('mode_magic')}
                </button>
              </div>

              {mode === 'password' ? (
                <PasswordLoginForm
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  loading={loading}
                  error={error}
                  setError={setError}
                  onSubmit={handlePasswordLoginSuccess}
                  redirectTo={redirectTo}
                />
              ) : (
                <MagicLinkForm
                  email={email}
                  setEmail={setEmail}
                  loading={loading}
                  error={error}
                  setError={setError}
                  onSuccess={() => setMagicSent(true)}
                />
              )}
            </>
          )}
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">{t('or_contact_support')}</span>
          </div>
        </div>

        {/* Fallback contact */}
        <div className="space-y-2">
          <a
            href="https://t.me/Sophia_Bbot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
          >
            Telegram Bot @Sophia_Bbot
          </a>
          <a
            href="mailto:support@mekongmind.com"
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            support@mekongmind.com
          </a>
        </div>
      </div>

      {/* Back link */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          {t('back_to_home')}
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin';

  return (
    <AuthModeProvider initialTab={initialTab}>
      <LoginPageContent />
    </AuthModeProvider>
  );
}
