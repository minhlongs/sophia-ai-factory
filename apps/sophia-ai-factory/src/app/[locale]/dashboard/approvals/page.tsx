/**
 * Approvals page — lists pending approvals for the user's workspaces.
 */

import { Metadata } from 'next';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getUserWorkspaceIds } from '@/seed/auth/workspace-access';
import { getTranslations } from 'next-intl/server';
import { ApprovalQueue } from '@/components/approval-queue';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('approvals');
  return {
    title: t('pageTitle'),
    description: t('description'),
  };
}

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <div className="p-8 text-center text-destructive">Authentication required</div>;
  }

  const d1 = await getD1();
  if (!d1) {
    return <div className="p-8 text-center text-destructive">Database not available</div>;
  }

  // Get user's primary workspace (most recently joined)
  const workspaceIds = await getUserWorkspaceIds(user.id, d1);
  const primaryWorkspaceId = workspaceIds[0];

  if (!primaryWorkspaceId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No workspace found. Please create or join a workspace first.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
      <ApprovalQueue workspaceId={primaryWorkspaceId} />
    </div>
  );
}