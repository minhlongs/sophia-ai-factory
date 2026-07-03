'use client';

import { useTranslations } from 'next-intl';
import { LoginForm } from './login-form';

export function LoginPageComponent({ redirectTo }: { redirectTo?: string }) {
  const t = useTranslations('stitch.auth.login');

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0C] px-4 py-8 antialiased"
      data-testid="login-page"
    >
      {/* Ambient background accent */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-600/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-[440px] relative z-10">
        {/* Stitch card — #18181B bg, zinc-800 border, 20px padding, rounded-lg */}
        <div
          className="rounded-lg border border-zinc-800 bg-[#18181B] p-5 shadow-2xl"
          aria-label={t('title')}
        >
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mb-1">
              {t('heading')}
            </h1>
            <p className="text-sm text-zinc-400">
              {t('description')}
            </p>
          </div>

          <LoginForm redirectTo={redirectTo} />

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} Sophia AI Factory. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
