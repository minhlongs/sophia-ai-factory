'use client';

import React from 'react';
import type { SopTemplateRow, SopCategory } from '@/seed/sop/sop-types';
import { SopCard } from './sop-card';

export type CategoryFilter = SopCategory | 'all';

export function filterSopTemplates(
  templates: SopTemplateRow[],
  category: CategoryFilter,
  query: string,
  isVi: boolean,
): SopTemplateRow[] {
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
}

export function groupSopByCategory(
  filtered: SopTemplateRow[],
): Partial<Record<SopCategory, SopTemplateRow[]>> {
  const map: Partial<Record<SopCategory, SopTemplateRow[]>> = {};
  for (const tpl of filtered) {
    const cat = tpl.category;
    if (!map[cat]) map[cat] = [];
    map[cat]!.push(tpl);
  }
  return map;
}

export interface SopFeaturedSectionProps {
  featured: SopTemplateRow[];
  installedSet: Set<string>;
  locale: string;
  tierLocked: boolean;
  featuredTitle: string;
  onInstallClick: (template: SopTemplateRow) => void;
}

export function SopFeaturedSection({
  featured,
  installedSet,
  locale,
  tierLocked,
  featuredTitle,
  onInstallClick,
}: SopFeaturedSectionProps) {
  if (featured.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2 border-b border-primary/10 pb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        {featuredTitle}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((tpl) => (
          <SopCard
            key={tpl.id}
            template={tpl}
            locale={locale}
            alreadyInstalled={installedSet.has(tpl.id)}
            onInstallClick={onInstallClick}
            featured
            tierLocked={tierLocked && !installedSet.has(tpl.id)}
          />
        ))}
      </div>
    </section>
  );
}
