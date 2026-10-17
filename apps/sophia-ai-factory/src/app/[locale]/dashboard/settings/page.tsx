import { getCurrentUser } from '@/seed/auth/better-auth-session';
import SettingsPage from '@/components/stitch/screens/settings/settings-page';
import { StitchByokVaultBanner } from '@/components/stitch/screens/settings/stitch-byok-vault-banner';

export const dynamic = 'force-dynamic';

export default async function DashboardSettingsRoute() {
  const user = await getCurrentUser();
  return (
    <>
      <StitchByokVaultBanner />
      <SettingsPage
        userName={user?.full_name || ''}
        userEmail={user?.email || ''}
        initialTab="account"
      />
    </>
  );
}
