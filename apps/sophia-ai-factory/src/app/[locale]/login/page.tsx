'use client';

import { useTranslations } from 'next-intl';
import LoginPage from '@/components/stitch/screens/auth/login-page';

export default function LoginPageWithI18n() {
  const t = useTranslations('stitch.auth.login');

  return <LoginPage />;
}
