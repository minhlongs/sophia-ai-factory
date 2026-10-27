import React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

const OPC_EVIDENCE_LEVELS = [
  { level: 'L1', title: 'Code Wired to Runtime', badge: 'Runtime Bound' },
  { level: 'L2', title: 'Local Test Suite Green', badge: 'Vitest Verified' },
  { level: 'L3', title: 'Provider Integration', badge: 'S2S & BYOK' },
  { level: 'L4', title: 'Controlled Content Published', badge: 'CEO Approved' },
  { level: 'L5', title: 'Commission Confirmed', badge: 'Postback Verified' },
  { level: 'L6', title: 'Paid Receipt Received', badge: 'Domain B 0% Fee' },
  { level: 'L7', title: 'Repeat Real-User Loop', badge: 'Flywheel Active' },
];

export function OpcArchitectureBanner() {
  return (
    <div className="mt-14 pt-12 border-t border-[#E2E8F0] dark:border-white/[0.08]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#4338CA] dark:text-indigo-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            OPC 10-STEP PRODUCT CONTRACT • 7-LEVEL EVIDENCE CHAIN
          </span>
          <h4 className="text-xl font-bold text-[#0B0F19] dark:text-white mt-1">
            Dual-Niche Affiliate Governance (Crypto/CEX &amp; Global SaaS)
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Non-custodial affiliate operations: Niche &amp; Market → Program Connect → Offer Verify → Campaign &amp; Budget → CEO Approval (SHA-256) → Media Render → Compliance Gate → Controlled Publish → Attribution → Net Commission Reconciliation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0 font-mono text-[11px]">
          <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-[#4338CA] dark:text-indigo-300 border border-indigo-500/20 font-semibold">
            Crypto/CEX (Non-Custodial)
          </span>
          <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-[#D97706] dark:text-amber-300 border border-amber-500/20 font-semibold">
            Global SaaS (MRR)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {OPC_EVIDENCE_LEVELS.map((item) => (
          <div
            key={item.level}
            className="p-3 rounded-xl bg-white dark:bg-[#11131F] border border-[#E2E8F0] dark:border-white/[0.08] flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {item.level}
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <p className="text-xs font-bold text-[#0B0F19] dark:text-white leading-snug">
              {item.title}
            </p>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
              {item.badge}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
