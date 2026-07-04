/**
 * /dashboard/settings/team — Team member management for agency accounts.
 * Shows member list, invite form, role management, and member removal.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/settings/team/page
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { requireOrgMembership, getOrgMembers } from '@/seed/db/org-membership';
import { TeamManagementClient } from './team-management-client';

interface Props {
  params: Promise<{ locale: string }>;
}

export const metadata = { title: 'Team Management | Sophia AI' };

export default async function TeamPage({ params }: Props) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const membership = await requireOrgMembership(user.id);
  if (!membership.authorized) redirect(`/${locale}/dashboard`);

  const members = await getOrgMembers(membership.orgId);

  // Enrich with user details
  const { createServerClient } = await import('@/seed/db/client');
  const db = createServerClient();
  const enrichedMembers = await Promise.all(
    members.map(async (member) => {
      let email = '';
      let name = '';
      try {
        const { data: userData } = await db
          .from('user')
          .select('email, name')
          .eq('id', member.userId)
          .maybeSingle();
        if (userData) {
          const row = userData as Record<string, string>;
          email = row.email ?? '';
          name = row.name ?? '';
        }
      } catch {
        // non-fatal
      }
      return { ...member, email, name };
    }),
  );

  return (
    <TeamManagementClient
      currentUserId={user.id}
      currentUserRole={membership.role}
      members={enrichedMembers}
    />
  );
}
