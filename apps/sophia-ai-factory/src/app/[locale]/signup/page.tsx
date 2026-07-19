'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from '@/seed/navigation';
import { useSearchParams } from 'next/navigation';

/**
 * Loading/redirect UI for /[locale]/signup.
 * Displays a dark-indigo branded loading state matching the signup/login theme,
 * then client-redirects to /login?tab=signup with query params forwarded.
 *
 * Wrapping in Suspense is required for useSearchParams() in Next.js App Router
 * to prevent the page from de-opting out of static rendering.
 */

function SignupRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = new URLSearchParams({ tab: 'signup' });
    const coupon = searchParams?.get('coupon');
    const tier = searchParams?.get('tier');
    const redirect = searchParams?.get('redirect');

    if (typeof coupon === 'string') query.set('coupon', coupon);
    if (typeof tier === 'string') query.set('tier', tier);
    if (typeof redirect === 'string') query.set('redirect', redirect);

    router.push(`/login?${query.toString()}`);
  }, [router, searchParams]);

  return <SignupLoadingState />;
}

function SignupLoadingState() {
  return (
    <div className="min-h-screen bg-[#0F0F11] flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold text-white tracking-tight">
        Sophia<span className="text-primary">.</span>
      </h1>
      <p className="mt-4 text-sm text-zinc-400">Redirecting...</p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoadingState />}>
      <SignupRedirectContent />
    </Suspense>
  );
}
