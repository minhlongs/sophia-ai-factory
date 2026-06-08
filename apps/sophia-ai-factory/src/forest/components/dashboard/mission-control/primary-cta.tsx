'use client';
/**
 * Smart primary CTA — routes to upgrade/explore/renew based on ctaHint.
 * @module components/dashboard/mission-control/primary-cta
 */

interface PrimaryCtaProps {
  ctaHint: 'explore_sops' | 'upgrade' | 'renew';
  isVi?: boolean;
}

const CTA_CONFIG = {
  upgrade: {
    labelVi: 'Nâng cấp ngay',
    labelEn: 'Upgrade now',
    href: '/pricing',
    className: 'bg-primary hover:bg-primary/80 text-white',
  },
  explore_sops: {
    labelVi: 'Khám phá SOP',
    labelEn: 'Explore SOPs',
    href: '/dashboard/sop-marketplace',
    className: 'bg-muted hover:bg-muted/80 text-white',
  },
  renew: {
    labelVi: 'Gia hạn',
    labelEn: 'Renew',
    href: '/pricing',
    className: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
};

export function PrimaryCtaButton({ ctaHint, isVi = false }: PrimaryCtaProps) {
  const cfg = CTA_CONFIG[ctaHint];
  return (
    <a
      href={cfg.href}
      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${cfg.className}`}
    >
      {isVi ? cfg.labelVi : cfg.labelEn}
    </a>
  );
}
