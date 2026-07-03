'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/seed/components/ui/card';
import { LoginForm } from './login-form';

export function LoginPageComponent({ redirectTo }: { redirectTo?: string }) {
  const t = useTranslations('stitch.auth.login');

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 antialiased"
      data-testid="login-page"
    >
      {/* Ambient background accent */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-[440px] relative z-10">
        <Card
          className="p-8 md:p-10 shadow-2xl border-border"
          aria-label={t('title')}
        >
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">
              {t('heading')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('description')}
            </p>
          </div>

          <LoginForm redirectTo={redirectTo} />

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Sophia AI Factory. All rights reserved.
          </p>
        </Card>
      </div>
    </div>
  );
}
