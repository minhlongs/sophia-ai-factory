'use client';

/**
 * CategoryBadge — compact pill showing SOP category with color coding.
 * Supports all 8 categories including new 'sales' and 'social'.
 */

import { useTranslations } from 'next-intl';
import type { SopTemplateRow } from '@/tree/sop/sop-types';

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
  content:   'bg-primary/10 text-primary border-primary',
  leads:     'bg-emerald-500/10 text-emerald-400 border-emerald-500',
  email:     'bg-blue-500/10 text-blue-400 border-blue-500',
  analytics: 'bg-accent/10 text-accent border-accent',
  proposals: 'bg-amber-500/10 text-amber-400 border-amber-500',
  crisis:    'bg-rose-500/10 text-rose-400 border-rose-500',
  sales:     'bg-emerald-500/10 text-emerald-400 border-emerald-500',
  social:    'bg-primary/10 text-primary border-primary',
};

interface CategoryBadgeProps {
  category: Category;
  className?: string;
}

export function CategoryBadge({ category, className = '' }: CategoryBadgeProps) {
  const t = useTranslations('sop.categories');
  const colors = CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground border-border';
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
