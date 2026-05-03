'use client';

/**
 * SopCard — marketplace card for a single SOP template.
 *
 * Displays name, description, category badge, credits/run, and install CTA.
 * Click "Install" opens the install modal passed as modal trigger prop.
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { SopTemplateRow } from '@/lib/sop/sop-types';
import { CategoryBadge } from './category-badge';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

interface SopCardProps {
  template: SopTemplateRow;
  locale: string;
  alreadyInstalled: boolean;
  onInstallClick: (template: SopTemplateRow) => void;
}

export function SopCard({ template, locale, alreadyInstalled, onInstallClick }: SopCardProps) {
  const t = useTranslations('sop');
  const isVi = locale.startsWith('vi');
  const name = isVi ? template.name_vi : template.name_en;
  const description = isVi ? template.description_vi : template.description_en;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-violet-700/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-base truncate">{name}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
        </div>
        <CategoryBadge category={template.category} className="shrink-0" />
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Zap className="w-3.5 h-3.5 text-amber-400" />
        <span>{t('card.creditsPerRun', { n: template.credits_per_run })}</span>
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
