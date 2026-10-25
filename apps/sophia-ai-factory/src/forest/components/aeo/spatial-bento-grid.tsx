/**
 * Spatial Bento 2027 Grid & Card primitives for Sophia AI Factory.
 * Inherits --primary and --accent tokens from src/app/globals.css.
 * Layer: forest/components/aeo
 */

import type { ReactNode } from 'react';

export type BentoColSpan = 3 | 4 | 6 | 8 | 12;

const COL_SPAN_CLASSES: Record<BentoColSpan, string> = {
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  6: 'md:col-span-6',
  8: 'md:col-span-8',
  12: 'md:col-span-12',
};

export interface SpatialBentoGridProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly ariaLabel?: string;
}

export function SpatialBentoGrid({
  children,
  className = '',
  ariaLabel,
}: SpatialBentoGridProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={`spatial-bento-grid ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export interface SpatialBentoCardProps {
  readonly children: ReactNode;
  readonly colSpan?: BentoColSpan;
  readonly eyebrow?: string;
  readonly title?: string;
  readonly badge?: string;
  readonly className?: string;
  readonly citationAttr?: string;
}

export function SpatialBentoCard({
  children,
  colSpan = 6,
  eyebrow,
  title,
  badge,
  className = '',
  citationAttr,
}: SpatialBentoCardProps) {
  const spanClass = COL_SPAN_CLASSES[colSpan];
  return (
    <article
      data-aeo-citation={citationAttr}
      className={`spatial-bento-card p-5 sm:p-6 flex flex-col justify-between ${spanClass} ${className}`.trim()}
    >
      {(eyebrow || title || badge) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                {eyebrow}
              </p>
            )}
            {title && (
              <h3 className="mt-1 text-base sm:text-lg font-bold tracking-tight text-foreground">
                {title}
              </h3>
            )}
          </div>
          {badge && (
            <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
              {badge}
            </span>
          )}
        </header>
      )}
      <div className="flex-1">{children}</div>
    </article>
  );
}
