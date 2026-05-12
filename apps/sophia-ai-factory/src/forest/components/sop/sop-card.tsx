'use client';

/**
 * SopCard — marketplace card for a single SOP template.
 *
 * Shows name, description, category badge, credits/run, setup time, and install CTA.
 * Featured cards get a star badge. Install opens the no-code modal.
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Zap, Clock, Star } from 'lucide-react';
import type { SopTemplateRow } from '@/lib/sop/sop-types';
import { CategoryBadge } from './category-badge';
import { Button } from '@/seed/components/ui/button';

interface SopCardProps {
  template: SopTemplateRow;
  locale: string;
  alreadyInstalled: boolean;
  onInstallClick: (template: SopTemplateRow) => void;
  featured?: boolean;
}

export function SopCard({ template, locale, alreadyInstalled, onInstallClick, featured }: SopCardProps) {
  const t = useTranslations('sop');
  const isVi = locale.startsWith('vi');
  const name = isVi ? template.name_vi : template.name_en;
  const description = isVi ? template.description_vi : template.description_en;
  const setupTime = template.setup_time_minutes ?? 5;
  const isFeatured = template.is_featured === 1 || featured;

  return (
    <div className={`bg-card border rounded-xl p-5 flex flex-col gap-4 hover:border-violet-700/50 transition-colors ${isFeatured ? 'border-violet-700/40 ring-1 ring-violet-700/20' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isFeatured && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-amber-900/40 text-amber-300 border border-amber-700/50">
                <Star className="w-2.5 h-2.5" aria-hidden="true" />
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
          <Clock className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
          {t('card.setupTime', { n: setupTime })}
        </span>
      </div>

      <div className="flex gap-2 mt-auto">
        <Link
          href={`/dashboard/sop-marketplace/${template.slug}`}
          className="flex-1 text-center text-sm px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {t('card.viewDetails')}
        </Link>
        {alreadyInstalled ? (
          <span className="flex-1 text-center text-sm px-3 py-2 rounded-lg bg-zinc-800 text-zinc-500 cursor-not-allowed select-none">
            {t('card.installed')}
          </span>
        ) : (
          <Button
            size="sm"
            className="flex-1 bg-violet-700 hover:bg-violet-600"
            onClick={() => onInstallClick(template)}
          >
            {t('card.install')}
          </Button>
        )}
      </div>
    </div>
  );
}
