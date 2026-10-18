import React from 'react';
import { Link } from '@/navigation';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';
import { resolveRouteBannerCopy } from '@/tree/control-deck';

export interface MerkleSettlementBannerProps {
  readonly partnerCode: string;
  readonly commissionRatePct: number;
  readonly locale: string;
}

export function MerkleSettlementBanner({
  partnerCode,
  commissionRatePct,
  locale,
}: Readonly<MerkleSettlementBannerProps>) {
  const copy = resolveRouteBannerCopy('affiliate', locale === 'vi');

  return (
    <section
      role="region"
      aria-label={copy.ariaLabel}
      data-testid="stitch-merkle-settlement-banner"
      className="mx-auto mb-2 max-w-6xl overflow-x-hidden px-4 pt-4 md:px-6"
    >
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-400/35 bg-gradient-to-br from-[#121722] via-[#11131F] to-[#0B0E14] p-4 text-[#F8FAFC] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/15 text-amber-400 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.2)]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="font-semibold text-amber-400">{copy.badge}</span>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                {commissionRatePct}% {copy.pill} · {partnerCode}
              </span>
            </div>
            <h2 className="mt-1 font-sans text-sm font-semibold tracking-tight text-[#F8FAFC]">
              {copy.title}
            </h2>
          </div>
        </div>

        <Link
          href={copy.ctaHref}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-[#121722] px-4 py-2.5 font-mono text-xs font-semibold text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-400/15 hover:text-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none"
        >
          <span>{copy.ctaLabel}</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
