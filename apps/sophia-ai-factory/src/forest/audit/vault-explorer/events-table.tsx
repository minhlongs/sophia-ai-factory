/**
 * Audit Vault Explorer Events Table & Pagination
 * Layer: forest/audit (UI components & presentation)
 *
 * @module forest/audit/vault-explorer/events-table
 */

// i18n-namespace: auditVault

import React from 'react';
import { Eye, Copy, Check } from 'lucide-react';
import type { EnterpriseAuditEvent } from './types';

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
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-zinc-500"
                >
                  {t('table.empty')}
                </td>
              </tr>
            ) : (
              events.map((evt) => (
                <tr
                  key={evt.id}
                  className="cursor-pointer transition-colors hover:bg-zinc-800/40"
                  onClick={() => onSelectEvent(evt)}
                >
                  {/* Status / Hash Chain indicator */}
                  <td className="px-4 py-3">
                    {evt.prevHash === null ? (
                      <span
                        title="Genesis Event"
                        className="inline-flex items-center rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20"
                      >
                        GENESIS
                      </span>
                    ) : (
                      <span
                        title="Chained Record"
                        className="inline-flex items-center rounded bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20"
                      >
                        CHAINED
                      </span>
                    )}
                  </td>

                  {/* Timestamp & Action */}
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-400">
                    {formatTimestamp(evt.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-zinc-100">{evt.action}</span>
                  </td>

                  {/* Actor */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-zinc-200">{evt.actorEmail || evt.actorId}</span>
                      {evt.actorEmail && (
                        <span className="font-mono text-[10px] text-zinc-500">{evt.actorId}</span>
                      )}
                    </div>
                  </td>

                  {/* Resource */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-300">{evt.resourceType}</span>
                      {evt.resourceId && (
                        <span className="font-mono text-[11px] text-zinc-500">
                          ({evt.resourceId.slice(0, 8)})
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Content Hash */}
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span>
                        {evt.contentHash.slice(0, 8)}...
                        {evt.contentHash.slice(-6)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyHash(evt.contentHash);
                        }}
                        className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                      >
                        {copiedHash === evt.contentHash ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Details Action */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt);
                      }}
                      className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>{t('table.viewDetails')}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
