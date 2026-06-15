/**
 * /dashboard/admin/tenant-lookup — Single-tenant 360 (admin only).
 *
 * Server Component. Renders a GET search form (no client JS); submitting it
 * sets `?tenantId=...` and the page re-renders with the resolved summary.
 *
 * Data source: `getTenantSummary` from `@/land/observability/tenant-summary`.
 */

import Link from 'next/link';
import { UserSearch } from 'lucide-react';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import {
  getTenantSummary,
  type TenantSummary,
} from '@/land/observability/tenant-summary';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/seed/components/ui/table';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tenantId?: string }>;
}

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

function fmtBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtAge(unixSec: number): string {
  if (unixSec === 0) return 'never';
  const ageSec = Math.floor(Date.now() / 1000) - unixSec;
  if (ageSec < 60) return `${ageSec}s ago`;
  if (ageSec < 3600) return `${Math.round(ageSec / 60)}m ago`;
  if (ageSec < 86400) return `${Math.round(ageSec / 3600)}h ago`;
  return `${Math.round(ageSec / 86400)}d ago`;
}

export default async function TenantLookupPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  await params;
  await requireMasterTier();

  const { tenantId } = await searchParams;
  const trimmed = tenantId?.trim();

  let summary: TenantSummary | null = null;
  let notFound = false;
  let queryError: string | null = null;

  if (trimmed) {
    try {
      summary = await getTenantSummary(trimmed);
      notFound = summary === null;
    } catch (err) {
      queryError = String(err);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <UserSearch className="w-6 h-6 text-primary-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">Tenant Lookup</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drop a tenant or user ID below to see storage, API keys, video jobs,
            referral codes, and the audit-log tail in one place.
          </p>
        </div>
      </header>

      <form
        action=""
        method="get"
        className="flex flex-wrap gap-2 items-center"
        role="search"
      >
        <label htmlFor="tenantId-input" className="sr-only">Tenant ID</label>
        <input
          id="tenantId-input"
          type="text"
          name="tenantId"
          defaultValue={trimmed ?? ''}
          placeholder="user_id or tenant_id"
          className="flex-1 min-w-[260px] rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="rounded-md border border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 px-4 py-2 text-sm font-medium text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 transition"
        >
          Look up
        </button>
      </form>

      {queryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Query failed: {queryError}
        </div>
      )}

      {notFound && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          No user matches <code className="font-mono">{trimmed}</code>.
        </div>
      )}

      {summary && <SummaryView summary={summary} />}
    </div>
  );
}

function SummaryView({ summary }: { summary: TenantSummary }): React.JSX.Element {
  const { user, storage, apiKeys, videoJobCount, referralCodeCount, auditLogCount, recentAudit } = summary;
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5 space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          User
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <FieldLabel label="Name" value={user.name ?? '—'} />
          <FieldLabel label="Email" value={user.email} mono />
          <FieldLabel label="Role" value={user.role} />
          <FieldLabel label="Joined" value={user.createdAt} mono />
          <FieldLabel label="User ID" value={user.id} mono span="col-span-2 lg:col-span-4" />
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Storage" value={storage ? fmtBytes(storage.totalBytes) : 'not tracked'} />
        <Stat label="Videos (R2)" value={storage ? storage.videoCount.toLocaleString() : '—'} />
        <Stat label="Video jobs" value={videoJobCount.toLocaleString()} />
        <Stat label="Storage recalc" value={storage ? fmtAge(storage.lastCalculatedAt) : '—'} />
        <Stat label="API keys (active/total)" value={`${apiKeys.active} / ${apiKeys.total}`} />
        <Stat label="Referral codes" value={referralCodeCount.toLocaleString()} />
        <Stat label="Audit entries" value={auditLogCount.toLocaleString()} />
        <Stat
          label="Audit filter"
          value={
            <Link
              href={`/dashboard/admin/audit-log?tenantId=${encodeURIComponent(user.id)}`}
              className="text-[var(--neon-cyan)] hover:underline"
            >
              open log →
            </Link>
          }
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Recent audit (10)
        </h2>
        {recentAudit.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground text-sm">
            No audit entries for this tenant.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left font-medium px-4 py-3">When</TableHead>
                  <TableHead className="text-left font-medium px-4 py-3">Action</TableHead>
                  <TableHead className="text-left font-medium px-4 py-3">Resource</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAudit.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="px-4 py-3 text-xs text-muted-foreground">{fmtAge(r.ts)}</TableCell>
                    <TableCell className="px-4 py-3 font-mono text-xs">{r.action}</TableCell>
                    <TableCell className="px-4 py-3 text-xs text-muted-foreground">{r.resource ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function FieldLabel({
  label,
  value,
  mono,
  span,
}: {
  label: string;
  value: string;
  mono?: boolean;
  span?: string;
}): React.JSX.Element {
  return (
    <div className={span ?? ''}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
