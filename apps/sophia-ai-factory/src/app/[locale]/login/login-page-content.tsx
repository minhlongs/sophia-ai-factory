'use client';

import { useSearchParams } from 'next/navigation';
import { LoginPageComponent } from '@/components/stitch/screens/login/login-page-component';
import RegisterPage from '@/components/stitch/screens/auth/register-page';

/**
 * Client Component that reads search params and renders the login page.
 * Separated from the route page to allow a Server Component wrapper
 * with Suspense, avoiding the Next.js `useSearchParams()` static-render error.
 */
export function LoginPageContent() {
  const searchParams = useSearchParams();
  const tab = searchParams?.get('tab');
  // Support both 'next' (from pricing/auth guard) and 'redirect' (from API GET handler)
  const redirectTo = searchParams?.get('next') || searchParams?.get('redirect') || undefined;

  if (tab === 'signup') {
    return <RegisterPage />;
  }

  return <LoginPageComponent redirectTo={redirectTo} />;
}
