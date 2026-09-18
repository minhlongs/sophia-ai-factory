import { LoginPage } from '@/components/stitch/screens/login';
import { redirect } from 'next/navigation';

interface LoginRouteProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; tab?: string; coupon?: string; tier?: string }>;
}

export default async function LocaleLoginRoute({ params, searchParams }: LoginRouteProps) {
  const { locale } = await params;
  const { next, tab, coupon, tier } = await searchParams;

  if (tab === 'signup') {
    const p = new URLSearchParams();
    if (next) p.set('next', next);
    if (coupon) p.set('coupon', coupon);
    if (tier) p.set('tier', tier);
    const qs = p.toString();
    redirect(`/${locale}/register${qs ? `?${qs}` : ''}`);
  }

  return <LoginPage redirectTo={next} />;
}
