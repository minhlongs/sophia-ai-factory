/**
 * Dunning history table and state badge components.
 * @module forest/components/dashboard/admin-billing-dunning-history
 */

'use client';

import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { DunningState } from './admin-billing-types';

export function DunningStateBadge({ state }: { state: string }): React.JSX.Element {
  const map: Record<string, { color: string; label: string }> = {
    current: { color: 'emerald', label: 'Current' },
    grace_period: { color: 'amber', label: 'Grace Period' },
    suspended: { color: 'red', label: 'Suspended' },
    pending: { color: 'amber', label: 'Pending' },
  };
  const s = map[state] ?? { color: 'muted', label: state };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      s.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400'
        : s.color === 'amber' ? 'bg-amber-500/10 text-amber-400'
          : s.color === 'red' ? 'bg-red-500/10 text-red-400'
            : 'bg-muted text-muted-foreground'
    }`}>
      {s.label}
    </span>
  );
}

export function renderHistoryTable(
  history: DunningState['history'],
  fmtDate: (ts: string | null) => string,
): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 border-b border-border text-xs font-medium text-muted-foreground">
        Attempt History ({history.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Attempt</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Result</th>
              <th className="px-4 py-2 text-left font-medium">Reason</th>
              <th className="px-4 py-2 text-left font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.map((h) => (
              <tr key={h.attemptNumber} className="hover:bg-muted/20">
                <td className="px-4 py-2 font-mono">#{h.attemptNumber}</td>
                <td className="px-4 py-2 capitalize">{h.attemptType}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center gap-1 ${h.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {h.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {h.success ? 'Success' : 'Failed'}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">{h.failureReason ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{fmtDate(h.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
