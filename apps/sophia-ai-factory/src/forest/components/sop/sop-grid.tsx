'use client';

/**
 * SopGrid — marketplace grid with featured section + category grouping.
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { SopTemplateRow, SopCategory } from '@/seed/sop/sop-types';
import { SopCard } from './sop-card';
import { SopFilters } from './sop-filters';
import { SopInstallModal } from './sop-install-modal';
import { ALL_SOP_CATEGORIES, SopCategorySection } from './sop-category-section';

type CategoryFilter = SopCategory | 'all';

interface SopGridProps {
  templates: SopTemplateRow[];
  installedTemplateIds: string[];
  locale: string;
  installAction: (formData: FormData) => Promise<{ error?: string }>;
  installCount?: number;
  sopInstallLimit?: number;
}

export function SopGrid({
  templates,
  installedTemplateIds,
  locale,
  installAction,
  installCount,
  sopInstallLimit,
}: SopGridProps) {
  const t = useTranslations('sop.marketplace');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [modalTemplate, setModalTemplate] = useState<SopTemplateRow | null>(null);
  const isVi = locale.startsWith('vi');
  const installedSet = useMemo(() => new Set(installedTemplateIds), [installedTemplateIds]);
  const tierLocked = (installCount ?? 0) >= (sopInstallLimit ?? 999);

  const featured = useMemo(() => templates.filter((tpl) => tpl.is_featured === 1), [templates]);

  const filtered = useMemo(() => {
    let list = templates;
    if (category !== 'all') list = list.filter((tpl) => tpl.category === category);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (tpl) =>
          tpl.name_vi.toLowerCase().includes(q) ||
          tpl.name_en.toLowerCase().includes(q) ||
          (isVi ? tpl.description_vi : tpl.description_en).toLowerCase().includes(q),
      );
    }
    return list;
  }, [templates, category, query, isVi]);

  const showGrouped = category === 'all' && !query.trim();

  const byCategory = useMemo(() => {
    const map: Partial<Record<SopCategory, SopTemplateRow[]>> = {};
    for (const tpl of filtered) {
      const cat = tpl.category;
      if (!map[cat]) map[cat] = [];
      map[cat]!.push(tpl);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-10">
      <SopFilters category={category} query={query} onCategoryChange={setCategory} onQueryChange={setQuery} />

      {category === 'all' && !query.trim() && featured.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2 border-b border-primary/10 pb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {t('featuredTitle')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((tpl) => (
              <SopCard
                key={tpl.id}
                template={tpl}
                locale={locale}
                alreadyInstalled={installedSet.has(tpl.id)}
                onInstallClick={setModalTemplate}
                featured
                tierLocked={tierLocked && !installedSet.has(tpl.id)}
              />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 bg-muted/10 border border-border rounded-2xl">
          <p className="text-muted-foreground">{t('noResults')}</p>
        </div>
      ) : showGrouped ? (
        <div className="space-y-10">
          {ALL_SOP_CATEGORIES.map((cat) => (
            <SopCategorySection
              key={cat}
              category={cat}
              templates={byCategory[cat] ?? []}
              installedSet={installedSet}
              locale={locale}
              onInstallClick={setModalTemplate}
              tierLocked={tierLocked}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => (
            <SopCard
              key={tpl.id}
              template={tpl}
              locale={locale}
              alreadyInstalled={installedSet.has(tpl.id)}
              onInstallClick={setModalTemplate}
              tierLocked={tierLocked && !installedSet.has(tpl.id)}
            />
          ))}
        </div>
      )}

      <SopInstallModal
        template={modalTemplate}
        locale={locale}
        open={modalTemplate !== null}
        onClose={() => setModalTemplate(null)}
        installAction={installAction}
      />
    </div>
  );
}
