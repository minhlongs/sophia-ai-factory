'use client';

/**
 * CategoryBadge — compact pill showing SOP category with color coding.
 */

import { useTranslations } from 'next-intl';
import type { SopTemplateRow } from '@/lib/sop/sop-types';

type Category = SopTemplateRow['category'];

const CATEGORY_COLORS: Record<Category, string> = {
  content:   'bg-violet-900/40 text-violet-300 border-violet-700/50',
  leads:     'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  email:     'bg-blue-900/40 text-blue-300 border-blue-700/50',
  analytics: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  proposals: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  crisis:    'bg-red-900/40 text-red-300 border-red-700/50',
};

interface CategoryBadgeProps {
  category: Category;
  className?: string;
}

export function CategoryBadge({ category, className = '' }: CategoryBadgeProps) {
  const t = useTranslations('sop.categories');
  const colors = CATEGORY_COLORS[category] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${colors} ${className}`}
    >
      {t(category)}
    </span>
  );
}
