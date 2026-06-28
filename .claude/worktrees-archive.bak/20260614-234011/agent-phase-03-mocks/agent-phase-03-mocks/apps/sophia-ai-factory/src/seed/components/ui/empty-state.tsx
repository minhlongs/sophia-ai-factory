/**
 * EmptyState — reusable zero-data placeholder component.
 *
 * Renders a centered layout with a Lucide icon, title, description,
 * and an optional CTA button/link.
 */

import React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

type CTAVariant = 'primary' | 'outline' | 'ghost';

interface EmptyStateCTA {
  label: string;
  href: string;
  variant?: CTAVariant;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: EmptyStateCTA;
  className?: string;
}

const VARIANT_CLASSES: Record<CTAVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary/90',
  outline:
    'border border-border text-foreground bg-transparent hover:bg-muted',
  ghost:
    'text-muted-foreground hover:text-foreground hover:bg-muted bg-transparent',
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  className,
}: EmptyStateProps) {
  const ctaVariant = cta?.variant ?? 'primary';

  return (
    <div
      className={[
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        'rounded-xl border border-border bg-card',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Icon container */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Copy */}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>

      {/* Optional CTA */}
      {cta && (
        <Link
          href={cta.href}
          className={[
            'mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors',
            VARIANT_CLASSES[ctaVariant],
          ].join(' ')}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
