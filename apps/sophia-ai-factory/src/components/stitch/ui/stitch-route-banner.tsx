import React from 'react';
import { Link } from '@/navigation';
import { ArrowUpRight } from 'lucide-react';

export interface StitchRouteBannerProps {
  readonly testId: string;
  readonly innerTestId?: string;
  readonly ariaLabel: string;
  readonly badgeText: string;
  readonly statusPillText?: string;
  readonly title: string;
  readonly description: string;
  readonly pills?: readonly string[];
  readonly ctaHref: string;
  readonly ctaLabel: string;
  readonly secondaryHref?: string;
  readonly secondaryLabel?: string;
  readonly tone?: 'amber' | 'emerald' | 'indigo';
  readonly className?: string;
}

const TONE_STYLES: Record<
  NonNullable<StitchRouteBannerProps['tone']>,
  { readonly border: string; readonly badge: string; readonly statusPill: string }
> = {
  amber: {
    border: 'border-amber-400/35',
    badge: 'text-amber-400',
    statusPill: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400',
  },
  emerald: {
    border: 'border-emerald-400/35',
    badge: 'text-emerald-400',
    statusPill: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
  },
  indigo: {
    border: 'border-indigo-400/35',
    badge: 'text-indigo-300',
    statusPill: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
  },
};

export function StitchRouteBanner({
  testId,
  innerTestId,
  ariaLabel,
  badgeText,
  statusPillText,
  title,
  description,
  pills,
  ctaHref,
  ctaLabel,
  secondaryHref,
  secondaryLabel,
  tone = 'amber',
  className = '',
}: Readonly<StitchRouteBannerProps>) {
  const palette = TONE_STYLES[tone];

  return (
    <section
      role="region"
      aria-label={ariaLabel}
      data-testid={testId}
      className={`overflow-x-hidden rounded-2xl border bg-gradient-to-br from-[#121722] via-[#11131F] to-[#0B0E14] p-4 text-[#F8FAFC] shadow-[0_8px_30px_rgba(0,0,0,0.45)] sm:p-5 ${palette.border} ${className}`.trim()}
    >
      <div data-testid={innerTestId} className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className={`font-semibold uppercase tracking-wider ${palette.badge}`}>{badgeText}</span>
            {statusPillText && (
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${palette.statusPill}`}>{statusPillText}</span>
            )}
          </div>
          <h2 className="mt-1 break-words font-sans text-sm font-semibold tracking-tight text-[#F8FAFC] sm:text-base">{title}</h2>
          <p className="mt-0.5 break-words text-xs leading-relaxed text-[#94A3B8]">{description}</p>
          {pills && pills.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {pills.map((pill) => (
                <span key={pill} className="rounded-md border border-[#1E2638] bg-[#0B0E14]/90 px-2 py-0.5 font-mono text-[11px] text-[#94A3B8]">{pill}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {secondaryHref && secondaryLabel && (
            <Link href={secondaryHref} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#1E2638] bg-[#0B0E14]/90 px-3.5 py-2 font-mono text-xs font-medium text-[#94A3B8] transition-colors hover:border-amber-400/40 hover:text-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none">
              {secondaryLabel}
            </Link>
          )}
          <Link href={ctaHref} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-amber-400/15 px-4 py-2.5 font-mono text-xs font-semibold text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-400/25 hover:text-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none">
            <span>{ctaLabel}</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
