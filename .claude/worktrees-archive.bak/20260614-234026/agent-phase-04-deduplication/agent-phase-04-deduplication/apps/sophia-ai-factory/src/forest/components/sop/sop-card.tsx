'use client';

/**
 * SopCard — marketplace card for a single SOP template.
 *
 * Shows name, description, category badge, credits/run, setup time, and install CTA.
 * Featured cards get a star badge. Install opens the no-code modal.
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Zap, Clock, Star, Lock } from 'lucide-react';
import type { SopTemplateRow } from '@/tree/sop/sop-types';
import { CategoryBadge } from './category-badge';
import { Button } from '@/seed/components/ui/button';

interface SopCardProps {
  template: SopTemplateRow;
  locale: string;
  alreadyInstalled: boolean;
  onInstallClick: (template: SopTemplateRow) => void;
  featured?: boolean;
  /** True when user has hit their tier's install limit and has not yet installed this template */
  tierLocked?: boolean;
}

export function SopCard({ template, locale, alreadyInstalled, onInstallClick, featured, tierLocked }: SopCardProps) {
  const t = useTranslations('sop');
  const isVi = locale.startsWith('vi');
  const name = isVi ? template.name_vi : template.name_en;
  const description = isVi ? template.description_vi : template.description_en;
  const setupTime = template.setup_time_minutes ?? 5;
  const isFeatured = template.is_featured === 1 || featured;

  const cardClassName = isFeatured
    ? 'bg-gradient-to-br from-muted/20 via-muted/30 to-accent/10 border border-primary/35 ring-1 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)] backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)] rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden'
    : 'bg-muted/10 border border-border backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)] rounded-xl p-5 flex flex-col gap-4';

  return (
    <div className={cardClassName}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isFeatured && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-primary/20 text-primary border border-primary/50">
                <Star className="w-2.5 h-2.5 animate-pulse" aria-hidden="true" />
                {t('card.featured')}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-foreground text-base truncate">{name}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
        </div>
        <CategoryBadge category={template.category} className="shrink-0" />
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          {t('card.creditsPerRun', { n: template.credits_per_run })}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          {t('card.setupTime', { n: setupTime })}
        </span>
      </div>

      <div className="flex gap-2 mt-auto">
        <Link
          href={`/dashboard/sop-marketplace/${template.slug}`}
          className="flex-1 text-center text-sm px-3 py-2 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all duration-200 hover:border-primary/50"
        >
          {t('card.viewDetails')}
        </Link>
        {alreadyInstalled ? (
          <span className="flex-1 text-center text-sm px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium select-none">
            {t('card.installed')}
          </span>
        ) : tierLocked ? (
          <Link
            href="/pricing"
            className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-amber-700/50 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40 transition-colors"
            title="Upgrade to install more SOPs"
          >
            <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {t('card.upgradeTier')}
          </Link>
        ) : (
          <Button
            size="sm"
            className="flex-1 bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all duration-200"
            onClick={() => onInstallClick(template)}
          >
            {t('card.install')}
          </Button>
        )}
      </div>
    </div>
  );
}
