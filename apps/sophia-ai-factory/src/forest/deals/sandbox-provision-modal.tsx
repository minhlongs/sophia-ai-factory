'use client';

/**
 * 1-Click Sandboxed Demo Workspace Provisioning Modal
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/sandbox-provision-modal
 */

import React from 'react';
import { X, Cpu } from 'lucide-react';
import type { EnterpriseDeal, SandboxProvisionResult } from '@/seed/types/enterprise-deal';
import { SandboxFeaturesGrid } from './sandbox-features-grid';
import { SandboxActivePanel } from './sandbox-active-panel';
import { SandboxEmptyPanel } from './sandbox-empty-panel';

interface SandboxProvisionModalProps {
  deal: EnterpriseDeal;
  sandbox: SandboxProvisionResult | null;
  isOpen: boolean;
  onClose: () => void;
  onProvision: () => Promise<void>;
  isLoading?: boolean;
}

export function SandboxProvisionModal({
  deal,
  sandbox,
  isOpen,
  onClose,
  onProvision,
  isLoading = false,
}: SandboxProvisionModalProps) {
  if (!isOpen) return null;

  const magicUrl = sandbox?.demoMagicUrl || (deal.sandboxToken ? `https://sophia.agencyos.network/sandbox/${deal.sandboxToken}` : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                1-Click Sandboxed Demo Workspace
              </h2>
              <p className="text-xs text-zinc-400">
                Isolated enterprise sandbox with 1,000 demo MCUs for {deal.companyName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <SandboxFeaturesGrid />
          {magicUrl ? (
            <SandboxActivePanel deal={deal} sandbox={sandbox} magicUrl={magicUrl} />
          ) : (
            <SandboxEmptyPanel onProvision={onProvision} isLoading={isLoading} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-3 bg-zinc-950 text-xs text-zinc-400">
          <span>Sophia Multitenancy Engine • Subaccount Isolation</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
