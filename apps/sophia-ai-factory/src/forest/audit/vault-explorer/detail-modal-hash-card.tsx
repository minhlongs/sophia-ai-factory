/**
 * Cryptographic hash chain card for Audit Vault Explorer DetailModal.
 * @module forest/audit/vault-explorer/detail-modal-hash-card
 */

// i18n-namespace: auditVault

import React from 'react';
import { Hash, ArrowRight, Copy, Check } from 'lucide-react';
import type { EnterpriseAuditEvent } from './types';

export function DetailModalHashCard({
  t,
  selectedEvent,
  copiedHash,
  onCopyText,
}: {
  t: (key: string) => string;
  selectedEvent: EnterpriseAuditEvent;
  copiedHash: string | null;
  onCopyText: (text: string) => void;
}) {
  return (
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
              {selectedEvent.prevHash || `(null) - ${t('modal.genesisEvent')}`}
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
  );
}
