/**
 * Overage events table for admin billing dashboard.
 *
 * @module forest/components/dashboard/admin-billing-overages-table
 */

'use client';

import { Zap, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import type { OverageEvent } from './admin-billing-types';

export function renderOverageTable(
  overages: OverageEvent[],
  loading: boolean,
  fmtCurrency: (n: number) => string,
  fmtDate: (ts: string | null) => string,
): React.JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Recent Overage Events
        </h2>
        <span className="text-xs text-muted-foreground">{overages.length} events</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Credits</th>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-left font-medium">Billed</th>
              <th className="px-4 py-3 text-left font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && overages.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : overages.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No overage events
                </td>
              </tr>
            ) : (
              overages.map((ev) => (
                <tr key={ev.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <code className="font-mono text-xs">{ev.userId.slice(0, 8)}...</code>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs capitalize">{ev.eventType}</span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs ${ev.creditsDelta > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {ev.creditsDelta > 0 ? '+' : ''}{ev.creditsDelta}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={ev.description}>
                    {ev.description}
                  </td>
                  <td className="px-4 py-2.5">
                    {ev.billed ? (
                      <span className="text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /></span>
                    ) : (
                      <span className="text-amber-400"><Clock className="w-3.5 h-3.5" /></span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDate(ev.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
