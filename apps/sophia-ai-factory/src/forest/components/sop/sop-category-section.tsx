'use client';

/**
 * Category section and featured section subcomponents for SopGrid.
 * @module forest/components/sop/sop-category-section
 */

import { useTranslations } from 'next-intl';
import type { SopTemplateRow, SopCategory } from '@/seed/sop/sop-types';
import { SopCard } from './sop-card';
import { CATEGORY_ICONS } from './category-badge';

export const ALL_SOP_CATEGORIES: SopCategory[] = [
  'content',
  'leads',
  'email',
  'sales',
  'social',
  'analytics',
  'crisis',
  'proposals',
];

export function SopCategorySection({
  category,
  templates,
  installedSet,
  locale,
  onInstallClick,
  tierLocked,
}: {
  category: SopCategory;
  templates: SopTemplateRow[];
  installedSet: Set<string>;
  locale: string;
  onInstallClick: (t: SopTemplateRow) => void;
  tierLocked: boolean;
}) {
  const t = useTranslations('sop.categories');
  if (templates.length === 0) return null;
  const icon = CATEGORY_ICONS[category] ?? '';

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 border-b border-border pb-2">
        <span aria-hidden="true" className="text-base">{icon}</span>
        <span>{t(category)}</span>
        <span className="text-[10px] text-muted-foreground font-normal normal-case">({templates.length} templates)</span>
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <SopCard
            key={tpl.id}
            template={tpl}
            locale={locale}
            alreadyInstalled={installedSet.has(tpl.id)}
            onInstallClick={onInstallClick}
            tierLocked={tierLocked && !installedSet.has(tpl.id)}
          />
        ))}
      </div>
    </section>
  );
}
