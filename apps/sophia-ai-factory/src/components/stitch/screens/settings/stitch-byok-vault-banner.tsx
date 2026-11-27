import React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/navigation';
import { KeyRound, ArrowUpRight } from 'lucide-react';
import { resolveRouteBannerCopy } from '@/tree/control-deck';

export function StitchByokVaultBanner() {
  const copy = resolveRouteBannerCopy('settings', useLocale() === 'vi');

  return (
    <section
      role="region"
      aria-label={copy.ariaLabel}
      data-testid="stitch-byok-vault-banner"
      className="mx-auto mb-6 max-w-6xl overflow-x-hidden px-4 pt-4 md:px-6"
    >
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{copy.badge}</span>
              <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                {copy.pill}
              </span>
            </div>
            <h2 className="mt-1 font-sans text-sm font-semibold tracking-tight text-foreground">
              {copy.title}
            </h2>
          </div>
        </div>

        <Link
          href={copy.ctaHref}
          className="md3-pill-button inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 border border-primary/35 bg-primary/10 px-4 py-2.5 font-mono text-xs font-semibold text-primary-text transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          <span>{copy.ctaLabel}</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
