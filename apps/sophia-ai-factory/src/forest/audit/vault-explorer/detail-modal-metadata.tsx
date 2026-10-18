/**
 * Audit Vault Explorer Detail Modal Metadata & Payload Sections
 * Layer: forest/audit (UI components & presentation)
 *
 * @module forest/audit/vault-explorer/detail-modal-metadata
 */

// i18n-namespace: auditVault

import React from 'react';
import { Copy } from 'lucide-react';
import type { EnterpriseAuditEvent } from './types';

export interface DetailModalMetadataProps {
  t: (key: string) => string;
  selectedEvent: EnterpriseAuditEvent;
  onCopyText: (text: string) => void;
  formatTimestamp: (ts: string | number) => string;
}

export function DetailModalMetadata({
  t,
  selectedEvent,
  onCopyText,
  formatTimestamp,
}: DetailModalMetadataProps) {
  return (
    <>
      {/* Event Metadata Grid */}
      <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        <div className="rounded-lg bg-zinc-900/60 p-3">
          <span className="text-zinc-500">{t('modal.actor')}</span>
          <p className="mt-0.5 font-medium text-zinc-200">
            {selectedEvent.actorEmail || selectedEvent.actorId}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-900/60 p-3">
          <span className="text-zinc-500">{t('modal.timestamp')}</span>
          <p className="mt-0.5 font-medium text-zinc-200">
            {formatTimestamp(selectedEvent.timestamp)}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-900/60 p-3">
          <span className="text-zinc-500">{t('modal.resourceType')}</span>
          <p className="mt-0.5 font-medium text-zinc-200">
            {selectedEvent.resourceType}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-900/60 p-3">
          <span className="text-zinc-500">{t('modal.resourceId')}</span>
          <p className="mt-0.5 font-mono font-medium text-zinc-200">
            {selectedEvent.resourceId || 'N/A'}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-900/60 p-3">
          <span className="text-zinc-500">{t('modal.ipAddress')}</span>
          <p className="mt-0.5 font-mono font-medium text-zinc-200">
            {selectedEvent.ipAddress || 'Internal Edge'}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-900/60 p-3">
          <span className="text-zinc-500">{t('modal.userAgent')}</span>
          <p className="mt-0.5 truncate font-medium text-zinc-200">
            {selectedEvent.userAgent || 'Sophia Platform Services'}
          </p>
        </div>
      </div>

      {/* Payload JSON Inspector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300">
            {t('modal.payload')}
          </span>
          <button
            onClick={() =>
              onCopyText(JSON.stringify(selectedEvent.payload, null, 2))
            }
            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            <Copy className="h-3 w-3" />
            <span>Copy JSON</span>
          </button>
        </div>
        <pre className="max-h-56 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/90 p-3.5 font-mono text-xs text-zinc-300">
          {JSON.stringify(selectedEvent.payload, null, 2)}
        </pre>
      </div>
    </>
  );
}
