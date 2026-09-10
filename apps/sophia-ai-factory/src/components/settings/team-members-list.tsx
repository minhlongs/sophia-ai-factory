'use client';

import React from 'react';
import { Users, UserPlus, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/seed/components/ui/input';
import type { TeamMember } from '@/land/account/ownership-management';

interface TeamMembersListProps {
  members: TeamMember[];
  isOwner: boolean;
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: 'EDITOR' | 'VIEWER';
  setInviteRole: (v: 'EDITOR' | 'VIEWER') => void;
  inviteLoading: boolean;
  feedback: string | null;
  onInvite: (e: React.FormEvent) => void;
  onRoleChange: (memberId: string, newRole: 'EDITOR' | 'VIEWER') => void;
  onRemove: (memberId: string) => void;
}

export function TeamMembersList({
  members,
  isOwner,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviteLoading,
  feedback,
  onInvite,
  onRoleChange,
  onRemove,
}: TeamMembersListProps) {
  return (
    <section className="bg-[#18181B] rounded-2xl p-6 shadow-xl border border-outline-variant/20 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Team Members & Collaboration
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">Control role access across OWNER, EDITOR, and VIEWER tiers.</p>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl text-xs text-primary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {feedback}
        </div>
      )}

      {isOwner && (
        <form onSubmit={onInvite} className="flex flex-col sm:flex-row gap-2.5">
          <Input
            type="email"
            placeholder="colleague@agency.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 text-xs bg-surface-container-lowest"
            required
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'EDITOR' | 'VIEWER')}
            className="bg-surface-container-highest border border-outline-variant/30 text-on-surface text-xs rounded-lg px-3 py-2"
          >
            <option value="EDITOR">EDITOR</option>
            <option value="VIEWER">VIEWER</option>
          </select>
          <button
            type="submit"
            disabled={inviteLoading || !inviteEmail.trim()}
            className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
          >
            {inviteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Invite Member
          </button>
        </form>
      )}

      <div className="divide-y divide-outline-variant/15">
        {members.map((m) => (
          <div key={m.id} className="py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{m.email}</p>
              <p className="text-xs text-on-surface-variant">Joined {new Date(m.joinedAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-3">
              {m.role === 'OWNER' ? (
                <span className="text-[11px] font-bold text-primary bg-primary/15 px-2.5 py-1 rounded-md">OWNER</span>
              ) : isOwner ? (
                <select
                  value={m.role}
                  onChange={(e) => onRoleChange(m.id, e.target.value as 'EDITOR' | 'VIEWER')}
                  className="bg-surface-container-highest border border-outline-variant/30 text-on-surface text-xs rounded-md px-2 py-1"
                >
                  <option value="EDITOR">EDITOR</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              ) : (
                <span className="text-xs text-on-surface-variant font-semibold">{m.role}</span>
              )}
              {isOwner && m.role !== 'OWNER' && (
                <button onClick={() => onRemove(m.id)} className="text-on-surface-variant hover:text-error p-1.5 transition-colors" title="Remove">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
