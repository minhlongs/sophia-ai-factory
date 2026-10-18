"use client";

import { Check, Minus } from 'lucide-react';

export interface PricingComparisonTableProps {
  currentTier?: string | null;
}

export interface TierDef {
  key: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  label: string;
  popular?: boolean;
}

export const TIER_KEYS: TierDef[] = [
  { key: 'BASIC', label: '' },
  { key: 'PREMIUM', label: '', popular: true },
  { key: 'ENTERPRISE', label: '' },
  { key: 'MASTER', label: '' },
];

export const TIER_LABEL_KEYS: Record<
  TierDef['key'],
  'table_tier_starter' | 'table_tier_growth' | 'table_tier_premium' | 'table_tier_master'
> = {
  BASIC: 'table_tier_starter',
  PREMIUM: 'table_tier_growth',
  ENTERPRISE: 'table_tier_premium',
  MASTER: 'table_tier_master',
};

export interface FeatureRow {
  label: string;
  values: (string | boolean)[];
}

export function formatNum(n: number): string {
  return n >= 999 ? '∞' : n.toLocaleString();
}

export function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="w-4 h-4 text-primary mx-auto" role="img" aria-label="Included" />;
  if (value === false) return <Minus className="w-4 h-4 text-muted-foreground mx-auto" role="img" aria-label="Not included" />;
  return <span className="text-sm text-foreground">{value}</span>;
}
