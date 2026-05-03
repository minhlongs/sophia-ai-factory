/**
 * /welcome/[token] — Customer Welcome Page (public, magic-link gated).
 * Shows personalized onboarding with 5 activation steps.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/welcome/[token]/page
 */

import { notFound } from 'next/navigation';
import { WelcomePageClient } from './welcome-page-client';

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const isVi = locale.startsWith('vi');
  return {
    title: isVi ? 'Chào mừng đến Sophia AI' : 'Welcome to Sophia AI',
  };
}

export default async function WelcomePage({ params }: Props) {
  const { locale, token } = await params;

  if (!token || token.length < 32) notFound();

  const isVi = locale.startsWith('vi');

  return <WelcomePageClient token={token} isVi={isVi} locale={locale} />;
}
