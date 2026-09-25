'use client';

/**
 * 1-Click Sandboxed Demo Workspace Provisioning Modal
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/sandbox-provision-modal
 */

import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, ShieldCheck, Cpu, Clock, Layers, Sparkles } from 'lucide-react';
import type { EnterpriseDeal, SandboxProvisionResult } from '@/seed/types/enterprise-deal';

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
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const magicUrl = sandbox?.demoMagicUrl || (deal.sandboxToken ? `https://sophia.agencyos.network/sandbox/${deal.sandboxToken}` : null);

  const handleCopyUrl = async () => {
    if (!magicUrl) return;
    await navigator.clipboard.writeText(magicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          {/* Features Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                <Cpu className="w-4 h-4 text-emerald-400" /> Demo Quota
              </div>
              <div className="text-lg font-bold text-white">1,000 MCU</div>
              <div className="text-[11px] text-zinc-500">~10 demo videos</div>
            </div>

            <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                <Clock className="w-4 h-4 text-blue-400" /> Trial Period
              </div>
              <div className="text-lg font-bold text-white">14 Days</div>
              <div className="text-[11px] text-zinc-500">Auto-expiring token</div>
            </div>

            <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                <ShieldCheck className="w-4 h-4 text-purple-400" /> Security
              </div>
              <div className="text-lg font-bold text-white">Isolated</div>
              <div className="text-[11px] text-zinc-500">Watermark enforced</div>
            </div>
          </div>

          {/* Sandbox Status Display */}
          {magicUrl ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" /> Sandbox Workspace Active
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">
                    Subaccount: {sandbox?.subaccountId || deal.sandboxSubaccountId}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    Client Demo Magic Access Link (Signed HMAC-SHA256 Token):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={magicUrl}
                      className="flex-1 px-3 py-2 text-xs font-mono rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 selection:bg-emerald-500/30 select-all"
                    />
                    <button
                      onClick={handleCopyUrl}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <a
                      href={magicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open
                    </a>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-400 pt-2 border-t border-emerald-900/40 flex items-center justify-between">
                  <span>Slug: {sandbox?.slug || `demo-${deal.companyDomain.split('.')[0]}`}</span>
                  <span>Watermark: Enforced on preview renders</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <Layers className="w-12 h-12 mx-auto text-zinc-600" />
              <div>
                <h3 className="text-base font-medium text-white">No Demo Workspace Provisioned</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                  Click below to instantly create an isolated client subaccount with 1,000 demo MCUs and generate a 14-day signed access link.
                </p>
              </div>

              <button
                onClick={onProvision}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isLoading ? 'Provisioning Sandbox...' : 'Activate 1-Click Demo Sandbox'}
              </button>
            </div>
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
