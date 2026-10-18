'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchOwnershipAction,
  toggleSupportAccessAction,
  listTeamMembersAction,
  inviteTeamMemberAction,
  updateTeamMemberRoleAction,
  removeTeamMemberAction,
} from '@/land/account/actions';
import type { AccountOwnershipDetails, TeamMember } from '@/land/account/ownership-management';
import { TeamMembersList } from './team-members-list';
import { OwnershipSupportCard } from './ownership-support-card';

export { OwnershipSupportCard } from './ownership-support-card';
export type { OwnershipSupportCardProps } from './ownership-support-card';

export function AccountOwnershipView() {
  const [details, setDetails] = useState<AccountOwnershipDetails | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [supportLoading, setSupportLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const d = await fetchOwnershipAction();
      setDetails(d);
      if (d?.orgId) {
        const m = await listTeamMembersAction(d.orgId);
        setMembers(m);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleToggleSupport = async () => {
    if (!details?.orgId) return;
    setSupportLoading(true);
    try {
      const nextState = !details.supportAccess.enabled;
      const res = await toggleSupportAccessAction(details.orgId, nextState);
      setDetails((prev) => (prev ? { ...prev, supportAccess: res } : null));
      setFeedback(nextState ? 'Support access granted for 24 hours.' : 'Support access revoked.');
    } catch {
      setFeedback('Failed to update support access.');
    } finally {
      setSupportLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !details?.orgId) return;
    setInviteLoading(true);
    try {
      await inviteTeamMemberAction({ orgId: details.orgId, email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      setFeedback('Invitation sent successfully.');
      await loadData();
    } catch {
      setFeedback('Failed to invite member.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'EDITOR' | 'VIEWER') => {
    if (!details?.orgId) return;
    try {
      await updateTeamMemberRoleAction({ orgId: details.orgId, memberId, role: newRole });
      await loadData();
    } catch {
      setFeedback('Failed to change role.');
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!details?.orgId || !confirm('Are you sure you want to remove this member?')) return;
    try {
      await removeTeamMemberAction({ orgId: details.orgId, memberId });
      await loadData();
    } catch {
      setFeedback('Failed to remove member.');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-on-surface-variant text-xs">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading workspace settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OwnershipSupportCard
        details={details}
        supportLoading={supportLoading}
        onToggleSupport={handleToggleSupport}
      />

      <TeamMembersList
        members={members}
        isOwner={Boolean(details?.isOwner)}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        inviteRole={inviteRole}
        setInviteRole={setInviteRole}
        inviteLoading={inviteLoading}
        feedback={feedback}
        onInvite={handleInvite}
        onRoleChange={handleRoleChange}
        onRemove={handleRemove}
      />
    </div>
  );
}
