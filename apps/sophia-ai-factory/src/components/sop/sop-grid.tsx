'use client';

/**
 * SopGrid — client wrapper that holds filter state + install modal.
 *
 * Receives full template list from server component, applies filters locally.
 * Renders SopCard grid + SopInstallModal.
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { SopTemplateRow } from '@/lib/sop/sop-types';
import { SopCard } from './sop-card';
import { SopFilters } from './sop-filters';
import { SopInstallModal } from './sop-install-modal';

type Category = SopTemplateRow['category'] | 'all';

interface SopGridProps {
  templates: SopTemplateRow[];
  installedTemplateIds: string[];
  locale: string;
  installAction: (formData: FormData) => Promise<{ error?: string }>;
}

export function SopGrid({ templates, installedTemplateIds, locale, installAction }: SopGridProps) {
  const t = useTranslations('sop.marketplace');
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [modalTemplate, setModalTemplate] = useState<SopTemplateRow | null>(null);
  const isVi = locale.startsWith('vi');
  const installedSet = useMemo(() => new Set(installedTemplateIds), [installedTemplateIds]);

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

  return (
    <div className="space-y-6">
      <SopFilters
        category={category}
        query={query}
        onCategoryChange={setCategory}
        onQueryChange={setQuery}
      />

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground">{t('noResults')}</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(tpl => (
            <SopCard
              key={tpl.id}
              template={tpl}
              locale={locale}
              alreadyInstalled={installedSet.has(tpl.id)}
              onInstallClick={setModalTemplate}
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
