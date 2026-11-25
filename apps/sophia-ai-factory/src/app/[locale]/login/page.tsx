import { LoginPage } from '@/components/stitch/screens/login';
import { isPilotInviteOnlyEnabled } from '@/seed/pilot/pilot-access-policy';
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

  const isPilot = isPilotInviteOnlyEnabled();
  const effectiveRedirectTo =
    next ?? (isPilot ? '/dashboard/first-value' : undefined);
  const emailOtpEnabled = !isPilot || Boolean(process.env.RESEND_API_KEY?.trim());

  return <LoginPage redirectTo={effectiveRedirectTo} emailOtpEnabled={emailOtpEnabled} />;
}
