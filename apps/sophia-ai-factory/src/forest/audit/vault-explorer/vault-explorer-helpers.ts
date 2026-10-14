/**
 * Filter payload and timestamp formatting helpers for AuditVaultExplorer.
 * @module forest/audit/vault-explorer/vault-explorer-helpers
 */

import type { AuditFilterOptions } from './types';

export function buildAuditFilterOptions(params: {
  orgId?: string;
  selectedAction: string;
  actorQuery: string;
  fromDate: string;
  toDate: string;
  pageSize: number;
  newPage: number;
}): AuditFilterOptions {
  const { orgId, selectedAction, actorQuery, fromDate, toDate, pageSize, newPage } = params;
  const fromTimestamp = fromDate
    ? Math.floor(new Date(fromDate).getTime() / 1000)
    : undefined;
  const toTimestamp = toDate
    ? Math.floor(new Date(toDate).setHours(23, 59, 59, 999) / 1000)
    : undefined;

  return {
    orgId,
    action: selectedAction !== 'all' ? selectedAction : undefined,
    actorEmail: actorQuery ? actorQuery.trim() : undefined,
    fromTimestamp,
    toTimestamp,
    limit: pageSize,
    offset: newPage * pageSize,
  };
}

export function formatAuditEventTimestamp(ts: string | number): string {
  const epochSec =
    typeof ts === 'string'
      ? Math.floor(new Date(ts).getTime() / 1000)
      : ts;
  return new Date(epochSec * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
