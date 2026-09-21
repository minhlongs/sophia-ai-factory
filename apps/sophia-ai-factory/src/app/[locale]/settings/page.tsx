import { getCurrentUser } from '@/seed/auth/better-auth-session';
import SettingsPage from '@/components/stitch/screens/settings/settings-page';

export const dynamic = 'force-dynamic';

export default async function SettingsRoute() {
  const user = await getCurrentUser();
  return (
    <SettingsPage
      userName={user?.full_name || ''}
      userEmail={user?.email || ''}
    />
  );
}
