'use client';

/**
 * CategoryBadge — compact pill showing SOP category with color coding.
 * Supports all 8 categories including new 'sales' and 'social'.
 */

import { useTranslations } from 'next-intl';
import type { SopTemplateRow } from '@/lib/sop/sop-types';

type Category = SopTemplateRow['category'];

export const CATEGORY_ICONS: Record<Category, string> = {
  content:   '\uD83C\uDFA5',  // 🎬
  leads:     '\uD83C\uDFAF',  // 🎯
  email:     '\uD83D\uDCE7',  // 📧
  analytics: '\uD83D\uDCCA',  // 📊
  proposals: '\uD83D\uDCBC',  // 💼
  crisis:    '\uD83D\uDEA8',  // 🚨
  sales:     '\uD83D\uDCB0',  // 💰
  social:    '\uD83D\uDCF1',  // 📱
};

const CATEGORY_COLORS: Record<Category, string> = {
  content:   'bg-violet-900/40 text-violet-300 border-violet-700/50',
  leads:     'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  email:     'bg-blue-900/40 text-blue-300 border-blue-700/50',
  analytics: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  proposals: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
  crisis:    'bg-red-900/40 text-red-300 border-red-700/50',
  sales:     'bg-green-900/40 text-green-300 border-green-700/50',
  social:    'bg-pink-900/40 text-pink-300 border-pink-700/50',
};

interface CategoryBadgeProps {
  category: Category;
  className?: string;
}

export function CategoryBadge({ category, className = '' }: CategoryBadgeProps) {
  const t = useTranslations('sop.categories');
  const colors = CATEGORY_COLORS[category] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700';
  const icon = CATEGORY_ICONS[category];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${colors} ${className}`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {t(category)}
    </span>
  );
}
