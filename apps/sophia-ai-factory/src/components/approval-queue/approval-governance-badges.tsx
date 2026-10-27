import React from 'react';
import { ShieldCheck, Lock, Globe2 } from 'lucide-react';
import type { Approval } from './types';

interface ApprovalGovernanceBadgesProps {
  approval: Approval;
}

export function ApprovalGovernanceBadges({ approval }: ApprovalGovernanceBadgesProps) {
  const isCrypto = approval.niche === 'crypto_global' || approval.actionSummary.toLowerCase().includes('crypto') || approval.actionSummary.toLowerCase().includes('cex');
  const isSaas = approval.niche === 'saas_global' || approval.actionSummary.toLowerCase().includes('saas');
  const jurisdiction = approval.jurisdiction || 'GLOBAL';

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
        {isCrypto ? '⚡ Crypto/CEX (Affiliate)' : isSaas ? '💻 Global SaaS (MRR)' : '🏢 OPC Campaign'}
      </span>

      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.05] border border-border">
        <Globe2 className="h-3 w-3 text-slate-500" />
        {jurisdiction}
      </span>

      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <Lock className="h-3 w-3 text-emerald-500" />
        SHA-256 Payload Lock
      </span>

      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3 w-3 text-emerald-500" />
        Domain B 0% Fee
      </span>
    </div>
  );
}
