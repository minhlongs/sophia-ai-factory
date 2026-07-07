'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LoginForm } from '@/components/stitch/screens/login/login-form';
import RegisterPage from '@/components/stitch/screens/auth/register-page';

/**
 * Client Component that reads search params and renders the login page.
 * Separated from the route page to allow a Server Component wrapper
 * with Suspense, avoiding the Next.js `useSearchParams()` static-render error.
 */
export function LoginPageContent() {
  const searchParams = useSearchParams();
  const tab = searchParams?.get('tab');
  const redirectTo = searchParams?.get('next') || searchParams?.get('redirect') || undefined;
  const t = useTranslations('stitch.auth.login');

  if (tab === 'signup') {
    return <RegisterPage />;
  }


  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-[#0F0F11] p-6 antialiased"
      data-testid="login-page"
    >
      {/* Ambient background accent */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/10/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[440px] relative z-10">
        <div
          className="rounded-[12px] border border-zinc-800 bg-[#18181B] p-8 md:p-10 shadow-2xl transition-all duration-500 hover:shadow-indigo-900/10"
          aria-label={t('title')}
        >
          {/* Logo + Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-10 h-10 mb-6 rounded-xl bg-gradient-to-br from-primary to-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>

            <h1 className="text-[24px] font-bold text-white tracking-tight mb-1">
              {t('heading')}
            </h1>
            <p className="text-[14px] text-[#A1A1AA]">
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
