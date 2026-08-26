// i18n-namespace: productionMonitoring
/**
 * Pending Approvals List — simple list of approvals awaiting human decision.
 * Server component; links to the existing /dashboard/approvals console.
 * Empty state is safe (renders a friendly message).
 *
 * @module components/production-monitoring/pending-approvals-list
 */

import { Link } from '@/navigation';
import type { PendingApprovalRow } from '@/land/production-monitoring/types';

type TFn = (key: string, values?: Record<string, string | number | Date>) => string;

interface PendingApprovalsListProps {
  approvals: PendingApprovalRow[];
  t: TFn;
}

function formatCents(cents: number | null): string {
  if (cents === null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleString();
}

export function PendingApprovalsList({ approvals, t }: PendingApprovalsListProps) {
  return (
    <section aria-labelledby="pending-approvals-heading" className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="pending-approvals-heading" className="text-lg font-semibold text-foreground">
          {t('pendingApprovalsTitle')}
        </h2>
        <Link
          href="/dashboard/approvals"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('viewAllApprovals')}
        </Link>
      </div>

      {approvals.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {t('noPendingApprovals')}
        </p>
      ) : (
        <ul className="space-y-2">
          {approvals.map((approval) => (
            <li
              key={approval.id}
              className="rounded-lg border border-border bg-card p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{approval.actionSummary}</span>
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {approval.actionType}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t('estimatedCost')}: {formatCents(approval.estimatedCostCents)}
                </span>
                <span>
                  {t('requestedAt')}: {formatTime(approval.createdAtMs)}
                </span>
                <span>
                  {t('deadline')}: {formatTime(approval.timeoutAtMs)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
