'use client';

/**
 * TeamManagementClient — client component for managing org team members.
 * Shows member list, invite form, role dropdown, and remove actions.
 * Bilingual Vi/En via next-intl.
 *
 * @module app/[locale]/dashboard/settings/team/team-management-client
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Shield, ShieldAlert, ShieldCheck, UserMinus, UserPlus, Mail } from 'lucide-react';
import type { OrgRole } from '@/seed/db/org-membership';
import { inviteTeamMember, removeTeamMemberAction, updateMemberRoleAction } from '@/app/actions/team-actions';
import type { TeamMemberEntry } from '@/app/actions/team-actions';

interface Props {
  currentUserId: string;
  currentUserRole: OrgRole;
  members: TeamMemberEntry[];
}

const ROLE_CONFIG: Record<OrgRole, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  owner: { icon: ShieldAlert, color: 'text-amber-500' },
  admin: { icon: ShieldCheck, color: 'text-blue-500' },
  member: { icon: Shield, color: 'text-emerald-500' },
  viewer: { icon: Shield, color: 'text-gray-500' },
};

const ROLE_OPTIONS: OrgRole[] = ['admin', 'member', 'viewer'];

export function TeamManagementClient({ currentUserId, currentUserRole, members: initialMembers }: Props) {
  const t = useTranslations('dashboard.settings.team');
  const router = useRouter();
  const [members, setMembers] = useState<TeamMemberEntry[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const isManager = currentUserRole === 'owner' || currentUserRole === 'admin';

  const clearStatus = useCallback(() => setStatus(null), []);

  async function handleInvite(formData: FormData) {
    const result = await inviteTeamMember(formData);
    if (result.success) {
      setStatus({ type: 'success', message: t('successInvited') });
      setInviteEmail('');
      router.refresh();
    } else {
      setStatus({ type: 'error', message: result.error });
    }
    setTimeout(clearStatus, 5000);
  }

  async function handleRemove(formData: FormData) {
    const result = await removeTeamMemberAction(formData);
    if (result.success) {
      const removedUserId = formData.get('memberUserId') as string;
      setMembers((prev) => prev.filter((m) => m.userId !== removedUserId));
      setStatus({ type: 'success', message: t('successRemoved') });
      router.refresh();
    } else {
      setStatus({ type: 'error', message: result.error });
    }
    setTimeout(clearStatus, 5000);
  }

  async function handleRoleChange(formData: FormData) {
    const result = await updateMemberRoleAction(formData);
    if (result.success) {
      const updatedUserId = formData.get('memberUserId') as string;
      const newRole = formData.get('role') as OrgRole;
      setMembers((prev) => prev.map((m) => (m.userId === updatedUserId ? { ...m, role: newRole } : m)));
      setStatus({ type: 'success', message: t('successRoleUpdated') });
      router.refresh();
    } else {
      setStatus({ type: 'error', message: result.error });
    }
    setTimeout(clearStatus, 5000);
  }

  const inputCls =
    'w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500';
  const selectCls =
    'bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500';

  function roleLabel(role: OrgRole): string {
    switch (role) {
      case 'owner': return t('roleOwner');
      case 'admin': return t('roleAdmin');
      case 'member': return t('roleMember');
      case 'viewer': return t('roleViewer');
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('pageSubtitle')}</p>
      </div>

      {/* Status message */}
      {status && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            status.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-600 border border-red-500/20'
          }`}
        >
          {status.message}
        </div>
      )}

      {/* Invite form (admin/owner only) */}
      {isManager && (
        <div className="rounded-xl border bg-card border-border p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            {t('inviteTitle')}
          </h2>
          <form action={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                name="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t('inviteEmailPlaceholder')}
                className={`${inputCls} pl-10`}
                required
              />
            </div>
            <select
              name="role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              className={selectCls}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
            >
              {t('inviteButton')}
            </button>
          </form>
        </div>
      )}

      {/* Member list */}
      <div className="rounded-xl border bg-card border-border">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            {t('memberListTitle')}
            <span className="ml-2 text-muted-foreground font-normal normal-case">
              ({members.length})
            </span>
          </h2>
        </div>

        {members.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            {t('noMembers')}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((member) => {
              const config = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.member;
              const RoleIcon = config.icon;
              const isSelf = member.userId === currentUserId;
              const canManage = isManager && !isSelf && member.role !== 'owner';

              return (
                <div key={member.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground shrink-0">
                      {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {member.name || member.email}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] bg-violet-500/10 text-violet-500 px-1.5 py-0.5 rounded-full font-medium">
                            {t('you')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Role badge */}
                    <div className="flex items-center gap-1.5">
                      <RoleIcon className={`w-4 h-4 ${config.color}`} />
                      {canManage ? (
                        <form action={handleRoleChange}>
                          <input type="hidden" name="memberUserId" value={member.userId} />
                          <select
                            name="role"
                            defaultValue={member.role}
                            onChange={(e) => {
                              const form = e.target.form;
                              if (form) {
                                const submit = document.createElement('button');
                                submit.type = 'submit';
                                submit.style.display = 'none';
                                form.appendChild(submit);
                                submit.click();
                                form.removeChild(submit);
                              }
                            }}
                            className={`${selectCls} text-xs py-1`}
                            aria-label="Change role"
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {roleLabel(role)}
                              </option>
                            ))}
                          </select>
                        </form>
                      ) : (
                        <span className={`text-xs font-medium ${config.color}`}>
                          {roleLabel(member.role)}
                        </span>
                      )}
                    </div>

                    {/* Remove button (manager only, not self, not owner) */}
                    {canManage && (
                      <form action={handleRemove}>
                        <input type="hidden" name="memberUserId" value={member.userId} />
                        <button
                          type="submit"
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                          aria-label="Remove member"
                          onClick={(e) => {
                            if (!confirm(t('removeConfirm'))) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
