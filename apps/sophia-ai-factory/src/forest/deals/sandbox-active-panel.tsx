'use client';

/**
 * Active sandbox workspace panel (magic link, copy/open actions)
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/sandbox-active-panel
 */

import React, { useState } from 'react';
import { Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import type { EnterpriseDeal, SandboxProvisionResult } from '@/seed/types/enterprise-deal';

interface SandboxActivePanelProps {
  deal: EnterpriseDeal;
  sandbox: SandboxProvisionResult | null;
  magicUrl: string;
}

export function SandboxActivePanel({ deal, sandbox, magicUrl }: SandboxActivePanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(magicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
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
  );
}
