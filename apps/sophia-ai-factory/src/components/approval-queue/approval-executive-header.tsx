import React from 'react';
import { ShieldCheck, Clock, DollarSign, CheckCircle2 } from 'lucide-react';
import type { Approval } from './types';

interface ApprovalExecutiveHeaderProps {
  approvals: Approval[];
}

export function ApprovalExecutiveHeader({ approvals }: ApprovalExecutiveHeaderProps) {
  const pendingCount = approvals.length;
  const totalEstCostCents = approvals.reduce((sum, a) => sum + (a.estimatedCostCents ?? 0), 0);
  const blockedCount = approvals.filter((a) => a.complianceStatus === 'blocked').length;

  return (
    <div
      data-testid="opc-ceo-approval-summary"
      className="mb-6 rounded-xl border border-border bg-card dark:bg-[#11131F] p-4 sm:p-5 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            CEO GOVERNANCE &amp; SHA-256 PAYLOAD INTEGRITY
          </span>
          <h2 className="text-base font-bold text-foreground mt-0.5">
            OPC Affiliate Campaign Approval Desk (Crypto/CEX &amp; Global SaaS)
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Kill-Switch: Armed
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
        <div className="rounded-lg bg-background/60 p-3 border border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-500" /> Pending Today
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-foreground">{pendingCount}</p>
        </div>

        <div className="rounded-lg bg-background/60 p-3 border border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-indigo-500" /> Est. Render Budget
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-foreground">
            ${(totalEstCostCents / 100).toFixed(2)}
          </p>
        </div>

        <div className="rounded-lg bg-background/60 p-3 border border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground">Compliance Blocked</span>
          <p className="mt-1 text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {blockedCount}
          </p>
        </div>

        <div className="rounded-lg bg-background/60 p-3 border border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground">Mutation Guard</span>
          <p className="mt-1 text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400 pt-1">
            SHA-256 Enforced
          </p>
        </div>
      </div>
    </div>
  );
}
