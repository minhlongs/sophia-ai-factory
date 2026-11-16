import React from 'react';
import { ShieldCheck } from 'lucide-react';

const OPC_JOURNEY_STEPS = [
  { title: 'Pick your niche and market' },
  { title: 'Connect an affiliate program' },
  { title: 'Confirm the offer and tracking link' },
  { title: 'Set campaign and budget' },
  { title: 'You approve before anything runs' },
  { title: 'Agents produce the video' },
  { title: 'Compliance check for your market' },
  { title: 'Publish on schedule' },
  { title: 'Track clicks from the real link' },
  { title: 'Match confirmed commissions' },
];

export function OpcArchitectureBanner() {
  return (
    <div className="mt-14 pt-12 border-t border-[#E2E8F0] dark:border-white/[0.08]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#4338CA] dark:text-indigo-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            How a campaign runs
          </span>
          <h4 className="text-xl font-bold text-[#0B0F19] dark:text-white mt-1">
            From picking an offer to matching your commissions (Crypto/CEX &amp; Global SaaS)
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            You approve every campaign before it runs. Earnings come from the affiliate programs you
            connect with your own account — Sophia never holds your commissions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0 text-[11px]">
          <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-[#4338CA] dark:text-indigo-300 border border-indigo-500/20 font-semibold">
            Crypto/CEX (Non-Custodial)
          </span>
          <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-[#D97706] dark:text-amber-300 border border-amber-500/20 font-semibold">
            Global SaaS (MRR)
          </span>
        </div>
      </div>

      <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {OPC_JOURNEY_STEPS.map((item, index) => (
          <li
            key={item.title}
            className="p-3 rounded-xl bg-white dark:bg-[#11131F] border border-[#E2E8F0] dark:border-white/[0.08] flex flex-col gap-1.5"
          >
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground self-start">
              {index + 1}
            </span>
            <p className="text-xs font-medium text-[#0B0F19] dark:text-white leading-snug">{item.title}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
