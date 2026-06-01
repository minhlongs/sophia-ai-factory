'use client';

/**
 * SopGrid — marketplace grid with featured section + category grouping.
 *
 * - Featured section at top (hero cards)
 * - Category filter tabs + search
 * - When "all" selected: group by category with headers
 * - When category selected: flat grid
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { SopTemplateRow, SopCategory } from '@/tree/sop/sop-types';
import { SopCard } from './sop-card';
import { SopFilters } from './sop-filters';
import { SopInstallModal } from './sop-install-modal';
import { CATEGORY_ICONS } from './category-badge';

type CategoryFilter = SopCategory | 'all';

interface SopGridProps {
  templates: SopTemplateRow[];
  installedTemplateIds: string[];
  locale: string;
  installAction: (formData: FormData) => Promise<{ error?: string }>;
  /** Number of SOPs the user has already installed */
  installCount?: number;
  /** Max allowed by the user's tier (from getSopInstallLimit) */
  sopInstallLimit?: number;
}

const ALL_CATEGORIES: SopCategory[] = ['content', 'leads', 'email', 'sales', 'social', 'analytics', 'crisis', 'proposals'];

function CategorySection({
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
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2">
        <span aria-hidden="true" className="text-base">{icon}</span>
        <span>{t(category)}</span>
        <span className="text-[10px] text-zinc-500 font-normal normal-case">({templates.length} templates)</span>
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map(tpl => (
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

export function SopGrid({ templates, installedTemplateIds, locale, installAction, installCount, sopInstallLimit }: SopGridProps) {
  const t = useTranslations('sop.marketplace');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [modalTemplate, setModalTemplate] = useState<SopTemplateRow | null>(null);
  const isVi = locale.startsWith('vi');
  const installedSet = useMemo(() => new Set(installedTemplateIds), [installedTemplateIds]);
  const tierLocked = (installCount ?? 0) >= (sopInstallLimit ?? 999);

  const featured = useMemo(() => templates.filter(t => t.is_featured === 1), [templates]);

  const filtered = useMemo(() => {
    let list = templates;
    if (category !== 'all') list = list.filter(t => t.category === category);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(t =>
        t.name_vi.toLowerCase().includes(q) ||
        t.name_en.toLowerCase().includes(q) ||
        (isVi ? t.description_vi : t.description_en).toLowerCase().includes(q),
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
      <SopFilters
        category={category}
        query={query}
        onCategoryChange={setCategory}
        onQueryChange={setQuery}
      />

      {/* Featured section — only when not filtering */}
      {category === 'all' && !query.trim() && featured.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2 border-b border-violet-500/10 pb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            {t('featuredTitle')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map(tpl => (
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

      {/* Main grid */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-20 bg-white/[0.01] border border-white/5 rounded-2xl">
          <p className="text-muted-foreground">{t('noResults')}</p>
        </div>
      ) : showGrouped ? (
        // Grouped by category view
        <div className="space-y-10">
          {ALL_CATEGORIES.map(cat => (
            <CategorySection
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
        // Flat filtered view
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(tpl => (
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
