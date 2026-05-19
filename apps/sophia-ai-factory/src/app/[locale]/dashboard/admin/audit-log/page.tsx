// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/audit-log — Tenant audit trail viewer (admin only).
 *
 * Server Component. Renders a table of recent audit_log rows with optional
 * tenantId / action filters supplied via query string. Top-actions sidebar
 * shows the most frequent actions in the last 7 days for quick navigation.
 */

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import {
  searchAuditLog,
  getTopActions,
  type AuditLogRow,
} from '@/land/observability/audit-log-stats';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tenantId?: string; action?: string }>;
}

const PAGE_SIZE = 100;
const TOP_WINDOW_SEC = 7 * 86400;

function fmtAge(unixSec: number): string {
  const ageSec = Math.floor(Date.now() / 1000) - unixSec;
  if (ageSec < 60) return `${ageSec}s ago`;
  if (ageSec < 3600) return `${Math.round(ageSec / 60)}m ago`;
  if (ageSec < 86400) return `${Math.round(ageSec / 3600)}h ago`;
  return `${Math.round(ageSec / 86400)}d ago`;
}

function fmtMetadata(meta: Record<string, unknown> | null): string {
  if (!meta) return '—';
  const json = JSON.stringify(meta);
  return json.length > 80 ? `${json.slice(0, 77)}…` : json;
}

export default async function AuditLogPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  await params;
  await requireMasterTier();

  const { tenantId, action } = await searchParams;

  const now = Math.floor(Date.now() / 1000);
  const fromTs = now - TOP_WINDOW_SEC;

  let rows: AuditLogRow[] = [];
  let topActions: { action: string; count: number }[] = [];
  let queryError: string | null = null;

  try {
    [rows, topActions] = await Promise.all([
      searchAuditLog({ tenantId, action, limit: PAGE_SIZE }),
      getTopActions(fromTs, now, 10),
    ]);
  } catch (err) {
    queryError = String(err);
  }

  const hasFilter = Boolean(tenantId || action);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <FileText className="w-6 h-6 text-violet-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tenant-scoped activity stream. Use top-actions chips to filter; clear
            via the All chip. Up to {PAGE_SIZE} rows per page.
          </p>
        </div>
      </header>

      {queryError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Failed to load audit log: {queryError}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Top actions (last 7 days)
        </h2>
        <nav className="flex flex-wrap gap-2" aria-label="Filter by action">
          <FilterChip
            href={tenantId ? `/dashboard/admin/audit-log?tenantId=${encodeURIComponent(tenantId)}` : '/dashboard/admin/audit-log'}
            label={`All${topActions.length > 0 ? '' : ' (no data)'}`}
            active={!action}
          />
          {topActions.map((a) => {
            const params = new URLSearchParams();
            params.set('action', a.action);
            if (tenantId) params.set('tenantId', tenantId);
            return (
              <FilterChip
                key={a.action}
                href={`/dashboard/admin/audit-log?${params.toString()}`}
                label={`${a.action} (${a.count})`}
                active={action === a.action}
              />
            );
          })}
        </nav>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {hasFilter ? 'Filtered rows' : 'Recent activity'}
          </h2>
          <span className="text-xs text-muted-foreground">{rows.length} rows</span>
        </div>

        {rows.length === 0 && !queryError ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
            No audit rows match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Audit log entries newest first</caption>
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">When</th>
                  <th scope="col" className="px-4 py-3 font-medium">Tenant</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actor</th>
                  <th scope="col" className="px-4 py-3 font-medium">Action</th>
                  <th scope="col" className="px-4 py-3 font-medium">Resource</th>
                  <th scope="col" className="px-4 py-3 font-medium">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtAge(r.ts)}</td>
                    <td className="px-4 py-3 font-mono text-[11px] truncate max-w-[180px]" title={r.tenantId}>
                      {r.tenantId}
                    </td>
                    <td className="px-4 py-3 text-xs">{r.actor}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.resource ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono max-w-md truncate" title={r.metadata ? JSON.stringify(r.metadata) : ''}>
                      {fmtMetadata(r.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)]'
          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}
