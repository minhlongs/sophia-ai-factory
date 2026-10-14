/**
 * Audit Vault Explorer Events Table & Pagination
 * Layer: forest/audit (UI components & presentation)
 *
 * @module forest/audit/vault-explorer/events-table
 */

// i18n-namespace: auditVault

import React from 'react';
import type { EnterpriseAuditEvent } from './types';
import { AuditEventTableRow } from './events-table-row';

export interface EventsTableProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  events: EnterpriseAuditEvent[];
  total: number;
  page: number;
  pageSize: number;
  copiedHash: string | null;
  onCopyHash: (hash: string) => void;
  onSelectEvent: (event: EnterpriseAuditEvent) => void;
  onPageChange: (newPage: number) => void;
  formatTimestamp: (ts: string | number) => string;
}

export function EventsTable({
  t,
  events,
  total,
  page,
  pageSize,
  copiedHash,
  onCopyHash,
  onSelectEvent,
  onPageChange,
  formatTimestamp,
}: EventsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/70 text-xs font-medium text-zinc-400">
            <tr>
              <th className="px-4 py-3.5">{t('table.status')}</th>
              <th className="px-4 py-3.5">{t('table.timestamp')}</th>
              <th className="px-4 py-3.5">{t('table.action')}</th>
              <th className="px-4 py-3.5">{t('table.actor')}</th>
              <th className="px-4 py-3.5">{t('table.resource')}</th>
              <th className="px-4 py-3.5">{t('table.contentHash')}</th>
              <th className="px-4 py-3.5 text-right">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {events.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                  {t('table.empty')}
                </td>
              </tr>
            ) : (
              events.map((evt) => (
                <AuditEventTableRow
                  key={evt.id}
                  evt={evt}
                  t={t}
                  copiedHash={copiedHash}
                  onCopyHash={onCopyHash}
                  onSelectEvent={onSelectEvent}
                  formatTimestamp={formatTimestamp}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400">
        <span>
          {t('pagination.showing', {
            start: total === 0 ? 0 : page * pageSize + 1,
            end: Math.min((page + 1) * pageSize, total),
            total,
          })}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1 font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            {t('pagination.previous')}
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={(page + 1) * pageSize >= total}
            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1 font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          >
            {t('pagination.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
