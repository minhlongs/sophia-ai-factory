'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, LifeBuoy, Loader2 } from 'lucide-react';
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
    return <div className="p-8 text-center text-on-surface-variant text-xs"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading workspace settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Ownership & Support Delegation */}
      <section className="bg-[#18181B] rounded-2xl p-6 shadow-xl border border-outline-variant/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-outline-variant/15">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                {details?.orgName || 'Workspace'}
              </h3>
              {details?.isOwner && (
                <span className="bg-primary/20 text-primary border border-primary/40 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Organization Owner
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant font-mono">ID: {details?.orgId}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleSupport}
              disabled={supportLoading || !details?.isOwner}
              className={`text-xs px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 border ${
                details?.supportAccess.enabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-surface-container-highest hover:bg-surface-container text-on-surface border-outline-variant/30'
              }`}
            >
              <LifeBuoy className="w-4 h-4" />
              {details?.supportAccess.enabled ? 'Revoke Support Access' : 'Allow Sophia Support (24h)'}
            </button>
          </div>
        </div>

        {details?.supportAccess.enabled && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Support access granted until {details.supportAccess.expiresAt ? new Date(details.supportAccess.expiresAt).toLocaleString() : '24 hours'}.</span>
          </div>
        )}
      </section>

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
