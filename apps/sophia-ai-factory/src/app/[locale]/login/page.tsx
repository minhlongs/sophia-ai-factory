'use client';

import { useSearchParams } from 'next/navigation';
import LoginPage from '@/components/stitch/screens/auth/login-page';
import RegisterPage from '@/components/stitch/screens/auth/register-page';

export default function LoginPageWithI18n() {
  const searchParams = useSearchParams();
  const tab = searchParams?.get('tab');

  if (tab === 'signup') {
    return <RegisterPage />;
  }

  return <LoginPage />;
}
