/**
 * Audit Vault Explorer Detail Modal
 * Layer: forest/audit (UI components & presentation)
 *
 * @module forest/audit/vault-explorer/detail-modal
 */

// i18n-namespace: auditVault

import React from 'react';
import { FileCode, X, Hash, ArrowRight, Copy, Check } from 'lucide-react';
import type { EnterpriseAuditEvent } from './types';

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
        <div className="space-y-3 rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <Hash className="h-4 w-4" />
            <span>{t('modal.cryptographicLink')}</span>
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-[11px] font-medium text-zinc-400">
                {t('modal.prevHash')}:
              </span>
              <div className="mt-1 flex items-center justify-between rounded bg-zinc-900/80 px-2.5 py-1.5 font-mono text-xs text-zinc-300">
                <span className="truncate">
                  {selectedEvent.prevHash ||
                    `(null) - ${t('modal.genesisEvent')}`}
                </span>
                {selectedEvent.prevHash && (
                  <button
                    onClick={() => onCopyText(selectedEvent.prevHash!)}
                    className="ml-2 text-zinc-500 hover:text-zinc-200"
                  >
                    {copiedHash === selectedEvent.prevHash ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-center text-indigo-400">
              <ArrowRight className="h-4 w-4 rotate-90" />
            </div>

            <div>
              <span className="text-[11px] font-medium text-zinc-400">
                {t('modal.contentHash')}:
              </span>
              <div className="mt-1 flex items-center justify-between rounded bg-zinc-900/80 px-2.5 py-1.5 font-mono text-xs text-emerald-400">
                <span className="truncate">{selectedEvent.contentHash}</span>
                <button
                  onClick={() => onCopyText(selectedEvent.contentHash)}
                  className="ml-2 text-zinc-500 hover:text-zinc-200"
                >
                  {copiedHash === selectedEvent.contentHash ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            <div className="text-[11px] italic text-zinc-500">
              Formula: {t('modal.hashFormula')}
            </div>
          </div>
        </div>

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
