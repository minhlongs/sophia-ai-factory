/**
 * Audit Vault Explorer Detail Modal
 * Layer: forest/audit (UI components & presentation)
 *
 * @module forest/audit/vault-explorer/detail-modal
 */

// i18n-namespace: auditVault

import React from 'react';
import { FileCode, X } from 'lucide-react';
import type { EnterpriseAuditEvent } from './types';
import { DetailModalHashCard } from './detail-modal-hash-card';
import { DetailModalMetadata } from './detail-modal-metadata';

export interface DetailModalProps {
  t: (key: string) => string;
  selectedEvent: EnterpriseAuditEvent | null;
  copiedHash: string | null;
  onClose: () => void;
  onCopyText: (text: string) => void;
  formatTimestamp: (ts: string | number) => string;
}

export function DetailModal({
  t,
  selectedEvent,
  copiedHash,
  onClose,
  onCopyText,
  formatTimestamp,
}: DetailModalProps) {
  if (!selectedEvent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-2xl space-y-6 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">
                {selectedEvent.action}
              </h3>
              <span className="font-mono text-xs text-zinc-500">
                ID: {selectedEvent.id}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cryptographic Hash Chain Link Card */}
        <DetailModalHashCard
          t={t}
          selectedEvent={selectedEvent}
          copiedHash={copiedHash}
          onCopyText={onCopyText}
        />

        {/* Event Metadata & Payload Inspector */}
        <DetailModalMetadata
          t={t}
          selectedEvent={selectedEvent}
          onCopyText={onCopyText}
          formatTimestamp={formatTimestamp}
        />

        {/* Modal Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
          >
            {t('modal.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
