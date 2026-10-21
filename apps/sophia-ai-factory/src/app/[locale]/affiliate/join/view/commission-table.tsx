// i18n-namespace: affiliateProgram

/**
 * Public affiliate commission table.
 *
 * Rates and plan prices are read from the programme's own constants
 * (`@/seed/config/revenue-share` and `@/seed/config/tiers`) so this table can
 * never drift from what the attribution resolver pays. It previously shipped as
 * a literal array with invented tier names, a flat rate range, and no lifetime
 * row, which is exactly the failure this derivation prevents.
 *
 * @module app/[locale]/affiliate/join/view/commission-table
 */

import { AFFILIATE_RATE_BY_TIER, AFFILIATE_RECURRING_MONTHS } from '@/seed/config/revenue-share';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';

/** The order partners see the plans in — cheapest first, lifetime last. */
const DISPLAY_ORDER: readonly Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

export interface CommissionRow {
  tier: Tier;
  /** Plan price, e.g. `$199/mo`, or `$4,999 one-time` for the lifetime plan. */
  price: string;
  /** Commission percentage, e.g. `30%`. */
  rate: string;
  /** Commission per referred customer, e.g. `$59.70`. */
  perReferral: string;
  /** Year-one total for monthly plans, or `once` for the lifetime plan. */
  annualised: string;
  /** False only for the lifetime plan, which pays a single time. */
  recurring: boolean;
}

/** Plan price carries no needless cents: `$199`, `$4,999`. */
function formatPriceUsd(cents: number): string {
  return `$${Math.floor(cents / 100).toLocaleString('en-US')}`;
}

/** Commission money where the cents are the point: `$59.70`, `$716.40`. */
function formatUsd(cents: number): string {
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, '0');
  return `$${whole.toLocaleString('en-US')}.${frac}`;
}

/**
 * Builds the displayed rows from the shared constants. Pure, so the derivation
 * is unit-testable and identical across locales.
 */
export function buildCommissionRows(): readonly CommissionRow[] {
  return DISPLAY_ORDER.map((tier) => {
    const definition = UNIFIED_TIERS[tier];
    const ratePct = AFFILIATE_RATE_BY_TIER[tier];
    const perReferralCents = Math.round((definition.priceInCents * ratePct) / 100);
    const isRecurring = definition.billingType === 'monthly';
    const annualCents = isRecurring ? perReferralCents * AFFILIATE_RECURRING_MONTHS : 0;
    return {
      tier,
      price: `${formatPriceUsd(definition.priceInCents)}${isRecurring ? '/mo' : ' one-time'}`,
      rate: `${ratePct}%`,
      perReferral: formatUsd(perReferralCents),
      annualised: isRecurring ? `${formatUsd(annualCents)}/yr` : 'once',
      recurring: isRecurring,
    };
  });
}

/** Precomputed once for the component; the table is static per deployment. */
export const COMMISSION_ROWS: readonly CommissionRow[] = buildCommissionRows();

export function CommissionTable({ t }: { t: (key: string) => string }) {
  return (
    <section className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold">{t('commission.title')}</h2>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">{t('commission.subtitle')}</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-5 py-3 text-left">{t('commission.tier_col')}</th>
              <th scope="col" className="px-5 py-3 text-right">{t('commission.price_col')}</th>
              <th scope="col" className="px-5 py-3 text-right">{t('commission.rate_col')}</th>
              <th scope="col" className="px-5 py-3 text-right text-emerald-400">{t('commission.earn_col')}</th>
              <th scope="col" className="px-5 py-3 text-right">{t('commission.total_col')}</th>
            </tr>
          </thead>
          <tbody>
            {COMMISSION_ROWS.map((row) => (
              <tr key={row.tier} className="border-t border-border">
                <td className="px-5 py-3 font-medium text-foreground">{row.tier}</td>
                <td className="px-5 py-3 text-right text-muted-foreground">{row.price}</td>
                <td className="px-5 py-3 text-right text-muted-foreground">{row.rate}</td>
                <td className="px-5 py-3 text-right font-semibold text-emerald-400">
                  {row.perReferral}
                  <span className="text-xs text-muted-foreground">
                    {row.recurring ? `/${t('commission.per_month')}` : ` ${t('commission.one_time')}`}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-muted-foreground">{row.annualised}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">{t('commission.note')}</p>
    </section>
  );
}
