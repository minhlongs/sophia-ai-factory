/**
 * /dashboard/admin/orgs — Client component for organization management.
 *
 * Renders org list table, create org dialog, invite/remove member actions.
 * Fetches org detail (members) on demand via server action.
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Building2,
  Plus,
  UserPlus,
  UserMinus,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  Users,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/seed/components/ui/table';
import { Button } from '@/seed/components/ui/button';
import { createOrg, inviteMember, removeMember, getOrgDetail } from '@/land/admin/org-manager';
import type { OrgRow, OrgDetail } from '@/land/admin/org-manager';

// ── Props ──────────────────────────────────────────────────────────────

interface OrgsClientProps {
  initialOrgs: OrgRow[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ── Types for local state ──────────────────────────────────────────────

interface ExpandedOrg {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  members: Array<{
    userId: string;
    email: string;
    fullName: string | null;
    role: string;
  }>;
}

// ── Main Component ─────────────────────────────────────────────────────

export function OrgsClient({ initialOrgs }: OrgsClientProps): React.JSX.Element {
  const t = useTranslations('admin.orgs');
  const router = useRouter();

  const [orgs, setOrgs] = useState<OrgRow[]>(initialOrgs);
  const [expanded, setExpanded] = useState<Record<string, ExpandedOrg>>({});
  const [loadingOrg, setLoadingOrg] = useState<string | null>(null);

  // Create org modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Invite member
  const [inviteOrgId, setInviteOrgId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // ── Toggle expand ──────────────────────────────────────────────────

  const handleToggleExpand = useCallback(
    async (orgId: string) => {
      if (expanded[orgId]) {
        const next = { ...expanded };
        delete next[orgId];
        setExpanded(next);
        return;
      }

      setLoadingOrg(orgId);
      try {
        const result = await getOrgDetail(orgId);
        if (result.ok) {
          const detail = result.value;
          setExpanded((prev) => ({
            ...prev,
            [orgId]: {
              id: detail.id,
              name: detail.name,
              description: detail.description,
              createdAt: detail.createdAt,
              memberCount: detail.memberCount,
              members: detail.members,
            },
          }));
        }
      } catch {
        // Silently handle — user can retry by collapsing/expanding
      } finally {
        setLoadingOrg(null);
      }
    },
    [expanded],
  );

  // ── Create org ─────────────────────────────────────────────────────

  const handleCreateOrg = useCallback(async () => {
    setCreateError(null);
    const trimmed = createName.trim();
    if (!trimmed) {
      setCreateError(t('nameRequired'));
      return;
    }

    setCreateLoading(true);
    try {
      const result = await createOrg(trimmed, createDesc.trim() || undefined);
      if (!result.ok) {
        setCreateError(result.error.message);
      } else {
        const { listOrgs: refreshList } = await import('@/land/admin/org-manager');
        const refreshed = await refreshList();
        if (refreshed.ok) {
          setOrgs(refreshed.value);
        }
        setShowCreate(false);
        setCreateName('');
        setCreateDesc('');
        router.refresh();
      }
    } catch {
      setCreateError(t('createError'));
    } finally {
      setCreateLoading(false);
    }
  }, [createName, createDesc, router, t]);

  // ── Invite member ──────────────────────────────────────────────────

  const handleInvite = useCallback(async () => {
    if (!inviteOrgId) return;
    setInviteError(null);
    setInviteSuccess(null);

    const trimmed = inviteEmail.trim();
    if (!trimmed) {
      setInviteError(t('emailRequired'));
      return;
    }

    setInviteLoading(true);
    try {
      const result = await inviteMember(inviteOrgId, trimmed, inviteRole);
      if (!result.ok) {
        setInviteError(result.error.message);
      } else {
        setInviteSuccess(t('inviteSuccess'));
        setInviteEmail('');
        const detailResult = await getOrgDetail(inviteOrgId);
        if (detailResult.ok) {
          const d = detailResult.value;
          setExpanded((prev) => ({
            ...prev,
            [inviteOrgId]: {
              id: d.id,
              name: d.name,
              description: d.description,
              createdAt: d.createdAt,
              memberCount: d.memberCount,
              members: d.members,
            },
          }));
        }
        router.refresh();
      }
    } catch {
      setInviteError(t('inviteError'));
    } finally {
      setInviteLoading(false);
    }
  }, [inviteOrgId, inviteEmail, inviteRole, router, t]);

  // ── Remove member ──────────────────────────────────────────────────

  const handleRemoveMember = useCallback(
    async (orgId: string, userId: string) => {
      const result = await removeMember(orgId, userId);
      if (!result.ok) {
        return result.error.message;
      }

      const detailResult = await getOrgDetail(orgId);
      if (detailResult.ok) {
        const d = detailResult.value;
        setExpanded((prev) => ({
          ...prev,
          [orgId]: {
            id: d.id,
            name: d.name,
            description: d.description,
            createdAt: d.createdAt,
            memberCount: d.memberCount,
            members: d.members,
          },
        }));
      }
      router.refresh();
      return null;
    },
    [router],
  );

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t('totalCount', { count: orgs.length })}
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t('createOrg')}
        </Button>
      </div>

      {/* Create org dialog */}
      {showCreate && (
        <CreateOrgDialog
          name={createName}
          description={createDesc}
          loading={createLoading}
          error={createError}
          onNameChange={setCreateName}
          onDescChange={setCreateDesc}
          onSubmit={handleCreateOrg}
          onClose={() => { setShowCreate(false); setCreateError(null); }}
        />
      )}

      {/* Org list */}
      {orgs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t('noOrgs')}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium px-4 py-3 w-8" />
                <TableHead className="text-xs font-medium px-4 py-3">{t('orgName')}</TableHead>
                <TableHead className="text-xs font-medium px-4 py-3 text-right">{t('members')}</TableHead>
                <TableHead className="text-xs font-medium px-4 py-3">{t('created')}</TableHead>
                <TableHead className="text-xs font-medium px-4 py-3 text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => (
                <OrgRowItem
                  key={org.id}
                  org={org}
                  isExpanded={!!expanded[org.id]}
                  isLoading={loadingOrg === org.id}
                  expanded={expanded[org.id] ?? null}
                  onToggle={() => handleToggleExpand(org.id)}
                  onInvite={() => {
                    setInviteOrgId(org.id);
                    setInviteEmail('');
                    setInviteError(null);
                    setInviteSuccess(null);
                  }}
                  onRemoveMember={(userId) => handleRemoveMember(org.id, userId)}
                />
              ))}
            </TableBody>
          </Table>

          {/* Invite member dialog */}
          {inviteOrgId && (
            <InviteDialog
              email={inviteEmail}
              role={inviteRole}
              loading={inviteLoading}
              error={inviteError}
              success={inviteSuccess}
              onEmailChange={setInviteEmail}
              onRoleChange={setInviteRole}
              onInvite={handleInvite}
              onClose={() => { setInviteOrgId(null); setInviteError(null); setInviteSuccess(null); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function OrgRowItem({
  org,
  isExpanded,
  isLoading,
  expanded: expandedData,
  onToggle,
  onInvite,
  onRemoveMember,
}: {
  org: OrgRow;
  isExpanded: boolean;
  isLoading: boolean;
  expanded: ExpandedOrg | null;
  onToggle: () => void;
  onInvite: () => void;
  onRemoveMember: (userId: string) => void;
}): React.JSX.Element {
  const t = useTranslations('admin.orgs');
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const handleRemove = async (userId: string) => {
    setRemovingUserId(userId);
    try {
      await onRemoveMember(userId);
    } finally {
      setRemovingUserId(null);
    }
  };

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-white/5" onClick={onToggle}>
        <TableCell className="px-4 py-3">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="text-muted-foreground hover:text-foreground transition"
              aria-label={isExpanded ? t('collapse') : t('expand')}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          )}
        </TableCell>
        <TableCell className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary-400 shrink-0" aria-hidden="true" />
            <span className="font-medium">{org.name}</span>
          </div>
        </TableCell>
        <TableCell className="px-4 py-3 text-right">
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            {org.memberCount}
          </span>
        </TableCell>
        <TableCell className="px-4 py-3 text-xs text-muted-foreground">
          {expandedData?.createdAt ? fmtDate(expandedData.createdAt) : '—'}
        </TableCell>
        <TableCell className="px-4 py-3 text-right">
          <button
            onClick={(e) => { e.stopPropagation(); onInvite(); }}
            className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition px-2 py-1.5 rounded hover:bg-primary-500/10 min-h-8"
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            {t('inviteMember')}
          </button>
        </TableCell>
      </TableRow>

      {/* Expanded member list */}
      {isExpanded && expandedData && (
        <TableRow>
          <TableCell colSpan={5} className="px-4 py-0">
            <div className="border-t border-white/5 bg-white/[0.02]">
              {expandedData.description && (
                <div className="px-6 pt-3 pb-2 text-xs text-muted-foreground">
                  {expandedData.description}
                </div>
              )}

              <div className="px-6 py-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {t('members')} ({expandedData.members.length})
                </h3>

                {expandedData.members.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('noMembers')}</p>
                ) : (
                  <div className="space-y-1">
                    {expandedData.members.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white/5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary-500/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-medium text-primary-400">
                              {(member.fullName ?? member.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm truncate">
                              {member.fullName ?? member.email}
                            </div>
                            {member.fullName && (
                              <div className="text-xs text-muted-foreground truncate">
                                {member.email}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border bg-primary-500/10 text-primary-400 border-primary-500/30">
                            {member.role}
                          </span>
                          <button
                            onClick={() => handleRemove(member.userId)}
                            disabled={removingUserId === member.userId}
                            className="text-muted-foreground hover:text-red-400 transition p-2 disabled:opacity-50"
                            aria-label={t('removeMember')}
                            title={t('removeMember')}
                          >
                            {removingUserId === member.userId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Create Org Dialog ──────────────────────────────────────────────────

function CreateOrgDialog({
  name,
  description,
  loading,
  error,
  onNameChange,
  onDescChange,
  onSubmit,
  onClose,
}: {
  name: string;
  description: string;
  loading: boolean;
  error: string | null;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const t = useTranslations('admin.orgs');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('createOrg')}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="org-name" className="text-xs text-muted-foreground">
              {t('orgName')}
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t('orgNamePlaceholder')}
              className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="org-desc" className="text-xs text-muted-foreground">
              {t('orgDescription')}
            </label>
            <textarea
              id="org-desc"
              rows={3}
              value={description}
              onChange={(e) => onDescChange(e.target.value)}
              placeholder={t('orgDescPlaceholder')}
              className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50 resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {t('creating')}
              </>
            ) : (
              t('create')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Invite Dialog ──────────────────────────────────────────────────────

function InviteDialog({
  email,
  role,
  loading,
  error,
  success,
  onEmailChange,
  onRoleChange,
  onInvite,
  onClose,
}: {
  email: string;
  role: string;
  loading: boolean;
  error: string | null;
  success: string | null;
  onEmailChange: (v: string) => void;
  onRoleChange: (v: string) => void;
  onInvite: () => void;
  onClose: () => void;
}): React.JSX.Element {
  const t = useTranslations('admin.orgs');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('inviteMember')}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-email" className="text-xs text-muted-foreground">
              {t('emailLabel')}
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-role" className="text-xs text-muted-foreground">
              {t('roleLabel')}
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => onRoleChange(e.target.value)}
              className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            >
              <option value="member">{t('roleMember')}</option>
              <option value="admin">{t('roleAdmin')}</option>
              <option value="owner">{t('roleOwner')}</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={onInvite} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {t('inviting')}
              </>
            ) : (
              t('inviteMember')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
