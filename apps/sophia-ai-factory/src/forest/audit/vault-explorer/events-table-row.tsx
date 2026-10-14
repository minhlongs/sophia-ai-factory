/**
 * Single row component for Audit Vault Explorer EventsTable.
 * @module forest/audit/vault-explorer/events-table-row
 */

// i18n-namespace: auditVault

import React from 'react';
import { Eye, Copy, Check } from 'lucide-react';
import type { EnterpriseAuditEvent } from './types';

export function AuditEventTableRow({
  evt,
  t,
  copiedHash,
  onCopyHash,
  onSelectEvent,
  formatTimestamp,
}: {
  evt: EnterpriseAuditEvent;
  t: (key: string, values?: Record<string, string | number>) => string;
  copiedHash: string | null;
  onCopyHash: (hash: string) => void;
  onSelectEvent: (event: EnterpriseAuditEvent) => void;
  formatTimestamp: (ts: string | number) => string;
}) {
  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-zinc-800/40"
      onClick={() => onSelectEvent(evt)}
    >
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

      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-400">
        {formatTimestamp(evt.timestamp)}
      </td>
      <td className="px-4 py-3">
        <span className="font-semibold text-zinc-100">{evt.action}</span>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-zinc-200">{evt.actorEmail || evt.actorId}</span>
          {evt.actorEmail && (
            <span className="font-mono text-[10px] text-zinc-500">{evt.actorId}</span>
          )}
        </div>
      </td>

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

      <td className="px-4 py-3 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span>
            {evt.contentHash.slice(0, 8)}...{evt.contentHash.slice(-6)}
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
  );
}
