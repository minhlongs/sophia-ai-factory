import RegisterPage from '@/components/stitch/screens/auth/register-page';
import { isPilotInviteOnlyEnabled } from '@/seed/pilot/pilot-access-policy';

interface RegisterRouteProps {
  searchParams?: Promise<{ next?: string }>;
}

export default async function LocaleRegisterRoute({ searchParams }: RegisterRouteProps = {}) {
  const resolved = searchParams ? await searchParams : {};
  const isPilot = isPilotInviteOnlyEnabled();
  const redirectTo = resolved.next ?? (isPilot ? '/dashboard/first-value' : undefined);
  const emailOtpEnabled = !isPilot || Boolean(process.env.RESEND_API_KEY?.trim());

  return <RegisterPage redirectTo={redirectTo} emailOtpEnabled={emailOtpEnabled} />;
}
