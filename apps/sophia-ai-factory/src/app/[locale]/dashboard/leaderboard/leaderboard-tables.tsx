/**
 * Leaderboard table components — creators and affiliates views.
 * @module app/[locale]/dashboard/leaderboard/leaderboard-tables
 */

import type { LeaderboardRow } from '@/land/affiliates/leaderboard';

export interface CreatorRow {
  authorUserId: string;
  sopCount: number;
  sales: number;
  revenueCents: number;
}

function shortenId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function fmtUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th scope="col" className={`px-4 py-3 font-medium ${right ? 'text-right' : ''}`}>
      {children}
    </th>
  );
}

function YouBadge() {
  return <span className="ml-2 text-[var(--neon-cyan)] text-xs">(You)</span>;
}

export function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground text-sm">
      No data yet
    </div>
  );
}

export function CreatorsTable({
  rows,
  currentUserId,
}: {
  rows: CreatorRow[];
  currentUserId: string;
}) {
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Top creators by total sales</caption>
        <thead className="bg-muted/40 text-left text-muted-foreground">
          <tr>
            <Th>Rank</Th>
            <Th>Creator</Th>
            <Th>SOPs</Th>
            <Th right>Sales</Th>
            <Th right>Revenue</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isMe = row.authorUserId === currentUserId;
            return (
              <tr
                key={row.authorUserId}
                className={`border-t border-border ${isMe ? 'bg-[var(--neon-cyan)]/5' : ''}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {shortenId(row.authorUserId)}
                  {isMe && <YouBadge />}
                </td>
                <td className="px-4 py-3">{row.sopCount}</td>
                <td className="px-4 py-3 text-right font-medium">{row.sales.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{fmtUsd(row.revenueCents)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AffiliatesTable({
  rows,
  currentUserId,
}: {
  rows: LeaderboardRow[];
  currentUserId: string;
}) {
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Top affiliates by performance</caption>
        <thead className="bg-muted/40 text-left text-muted-foreground">
          <tr>
            <Th>Rank</Th>
            <Th>Affiliate</Th>
            <Th right>Clicks</Th>
            <Th right>Conversions</Th>
            <Th right>Commission</Th>
            <Th right>EPC</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isMe = row.affiliateId === currentUserId;
            const displayName = row.name ?? row.email ?? shortenId(row.affiliateId);
            return (
              <tr
                key={row.affiliateId}
                className={`border-t border-border ${isMe ? 'bg-[var(--neon-cyan)]/5' : ''}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 text-xs">
                  {displayName}
                  {isMe && <YouBadge />}
                </td>
                <td className="px-4 py-3 text-right">{row.totalClicks.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{row.totalConversions.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {row.totalCommissionUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {row.epc.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 4,
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
