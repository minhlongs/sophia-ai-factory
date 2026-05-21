"use client";

/**
 * PricingComparisonTable — 4-tier comparison table for /pricing page.
 * Shows feature matrix across BASIC / PREMIUM / ENTERPRISE / MASTER.
 */

import { Check, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { UNIFIED_TIERS } from '@/seed/config/tiers';

interface PricingComparisonTableProps {
  currentTier?: string | null;
}

interface TierDef {
  key: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  label: string;
  popular?: boolean;
}

// Tier label keys resolved via t() inside component to avoid stale closure
const TIER_KEYS: TierDef[] = [
  { key: 'BASIC', label: '' },
  { key: 'PREMIUM', label: '', popular: true },
  { key: 'ENTERPRISE', label: '' },
  { key: 'MASTER', label: '' },
];

interface FeatureRow {
  label: string;
  values: (string | boolean)[];
}

function formatNum(n: number): string {
  return n >= 999 ? '∞' : n.toLocaleString();
}

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="w-4 h-4 text-green-500 mx-auto" role="img" aria-label="Included" />;
  if (value === false) return <Minus className="w-4 h-4 text-slate-300 dark:text-slate-700 mx-auto" role="img" aria-label="Not included" />;
  return <span className="text-sm text-slate-700 dark:text-slate-300">{value}</span>;
}

const TIER_LABEL_KEYS: Record<TierDef['key'], 'table_tier_starter' | 'table_tier_growth' | 'table_tier_premium' | 'table_tier_master'> = {
  BASIC: 'table_tier_starter',
  PREMIUM: 'table_tier_growth',
  ENTERPRISE: 'table_tier_premium',
  MASTER: 'table_tier_master',
};

export function PricingComparisonTable({ currentTier }: PricingComparisonTableProps) {
  const t = useTranslations('pricing');

  const TIERS: TierDef[] = TIER_KEYS.map((td) => ({
    ...td,
    label: t(TIER_LABEL_KEYS[td.key]),
  }));

  const rows: FeatureRow[] = [
    {
      label: t('row_mcu'),
      values: TIERS.map(({ key }) => formatNum(UNIFIED_TIERS[key].mcuMonthly)),
    },
    {
      label: t('row_campaigns'),
      values: TIERS.map(({ key }) => formatNum(UNIFIED_TIERS[key].campaignsPerMonth)),
    },
    {
      label: t('row_youtube'),
      values: TIERS.map(({ key }) => formatNum(UNIFIED_TIERS[key].youtubeChannels)),
    },
    {
      label: t('row_team'),
      values: TIERS.map(({ key }) => formatNum(UNIFIED_TIERS[key].teamMembers)),
    },
    {
      label: t('row_api'),
      values: TIERS.map(({ key }) => UNIFIED_TIERS[key].apiAccess),
    },
    {
      label: t('row_webhooks'),
      values: TIERS.map(({ key }) => UNIFIED_TIERS[key].webhooks),
    },
    {
      label: t('row_integrations'),
      values: TIERS.map(({ key }) => UNIFIED_TIERS[key].customIntegrations),
    },
    {
      label: t('row_white_label'),
      values: TIERS.map(({ key }) => UNIFIED_TIERS[key].whiteLabel),
    },
    {
      label: t('row_billing'),
      values: TIERS.map(({ key }) =>
        UNIFIED_TIERS[key].billingType === 'lifetime' ? t('billing_one_time') : t('billing_monthly')
      ),
    },
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 pb-16">
      <h2 className="text-2xl font-bold text-center text-foreground mb-8">{t('comparison_title')}</h2>
      <div className="overflow-x-auto rounded-2xl border border-white/20 shadow-lg">
        <table className="w-full text-sm bg-white/80 dark:bg-slate-900/60 backdrop-blur-md">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">{t('feature_compare')}</th>
              {TIERS.map(({ key, label, popular }) => (
                <th key={key} className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</span>
                    {popular && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                        {t('most_popular')}
                      </span>
                    )}
                    {currentTier === key && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium">
                        {t('current_plan_badge')}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
            {rows.map((row) => (
              <tr key={row.label} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors duration-150">
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-medium">{row.label}</td>
                {row.values.map((val, i) => (
                  <td key={i} className="px-4 py-3 text-center">
                    <Cell value={val} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
