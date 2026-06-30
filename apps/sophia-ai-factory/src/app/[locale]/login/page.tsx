'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LoginPage from '@/components/stitch/screens/auth/login-page';
import RegisterPage from '@/components/stitch/screens/auth/register-page';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const tab = searchParams?.get('tab');

  if (tab === 'signup') {
    return <RegisterPage />;
  }

  return <LoginPage />;
}

/**
 * Login page with Suspense boundary for useSearchParams().
 * Next.js requires a Suspense wrapper when useSearchParams() is used
 * in a component — otherwise the entire page de-opts from static rendering.
 */
export default function LoginPageWithI18n() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse h-8 w-48 bg-muted rounded" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
