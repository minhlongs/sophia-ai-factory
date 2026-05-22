/**
 * /dashboard/admin/invites — Beta creator invite management.
 * Server Component. MASTER tier only.
 */

import { Ticket } from 'lucide-react';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { listInvites } from '@/land/sop-marketplace/beta-invites';
import type { BetaInvite } from '@/land/sop-marketplace/beta-invites';
import { createInviteAction, revokeInviteAction } from './actions';

async function handleCreate(formData: FormData): Promise<void> {
  'use server';
  await createInviteAction(formData);
}

async function handleRevoke(id: string): Promise<void> {
  'use server';
  await revokeInviteAction(id);
}

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Beta Invites | Sophia AI Admin' };
}

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

function formatDate(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isExpired(invite: BetaInvite): boolean {
  return invite.expires_at !== null && invite.expires_at < Date.now();
}

function isExhausted(invite: BetaInvite): boolean {
  return invite.used_count >= invite.max_uses;
}

function statusBadge(invite: BetaInvite): React.JSX.Element {
  if (isExpired(invite)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-white/5 text-white/40 border-white/10">
        Expired
      </span>
    );
  }
  if (isExhausted(invite)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-green-500/10 text-green-400 border-green-500/20">
        Redeemed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-violet-500/10 text-violet-400 border-violet-500/20">
      Active
    </span>
  );
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function BetaInvitesPage({ params }: PageProps): Promise<React.JSX.Element> {
  await params;
  await requireMasterTier();

  const db = getD1();
  const invites = db ? await listInvites(db).catch(() => [] as BetaInvite[]) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/20">
          <Ticket className="w-5 h-5 text-violet-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Beta Invites</h1>
          <p className="text-sm text-white/50">Manage beta creator invitation codes</p>
        </div>
      </div>

      {/* Create form */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <h2 className="text-sm font-medium text-white/80 mb-4">Create Invite</h2>
        <form action={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs text-white/50">
              Email (optional)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="creator@example.com"
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="maxUses" className="text-xs text-white/50">
              Max Uses
            </label>
            <input
              id="maxUses"
              name="maxUses"
              type="number"
              defaultValue={1}
              min={1}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="expiresAt" className="text-xs text-white/50">
              Expires At (optional)
            </label>
            <input
              id="expiresAt"
              name="expiresAt"
              type="date"
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>

          <div className="sm:col-span-3 flex items-center gap-3">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-colors"
            >
              <Ticket className="w-4 h-4" aria-hidden="true" />
              Create Invite
            </button>
            <span className="text-xs text-white/40">50% commission for 60 days</span>
          </div>
        </form>
      </div>

      {/* Invites table */}
      <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
          <Ticket className="w-4 h-4 text-white/50" aria-hidden="true" />
          <h2 className="text-sm font-medium text-white/80">
            Invites ({invites.length})
          </h2>
        </div>

        {invites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Ticket className="w-10 h-10 text-white/20 mb-3" aria-hidden="true" />
            <p className="text-sm text-white/50">No invites yet</p>
            <p className="text-xs text-white/30 mt-1">Create your first beta invite above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-white/40">
                  <th className="px-5 py-3 text-left font-medium">Invite Code</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Used</th>
                  <th className="px-4 py-3 text-left font-medium">Expires</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3">
                      <code className="font-mono text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded text-xs">
                        {invite.code}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {invite.email ?? <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-white/70 text-xs">
                      {invite.used_count} / {invite.max_uses}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {formatDate(invite.expires_at)}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {formatDate(invite.created_at)}
                    </td>
                    <td className="px-4 py-3">{statusBadge(invite)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CopyButton code={invite.code} />
                        <form
                          action={async (fd: FormData) => {
                            'use server';
                            const id = fd.get('id') as string;
                            await handleRevoke(id);
                          }}
                        >
                          <input type="hidden" name="id" value={invite.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                          >
                            Revoke
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Copy button is a client component — extracted to avoid adding 'use client'
 * to the whole page. We use a simple inline form-compatible button that works
 * without JS by showing the code itself; the copy action requires JS.
 */
function CopyButton({ code }: { code: string }): React.JSX.Element {
  return (
    <button
      type="button"
      // onClick handled client-side via data attribute — requires a client component
      // for actual clipboard copy. For now this shows the code in title for copy.
      title={`Copy: ${code}`}
      className="text-xs text-white/50 hover:text-white/80 transition-colors px-2 py-1 rounded hover:bg-white/5"
      onClick={undefined}
      data-copy-code={code}
    >
      Copy
    </button>
  );
}
