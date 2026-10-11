/**
 * Pricing Card Types
 * Layer: forest/components/pricing/card
 */

import { FeatureGroups } from "../pricing-data";

export interface PricingCardProps {
  name: string;
  description: string;
  tier: string;
  /** Monthly price in cents — always the base for per-month equivalence display */
  monthlyPrice: number;
  /**
   * Annual price in cents — when provided, the card switches to annual display.
   * Undefined means monthly mode is active.
   */
  annualPriceCents?: number;
  /** Controls which period label (/yr vs /mo) is shown */
  billingPeriod?: "monthly" | "annual";
  featureGroups: FeatureGroups;
  popular?: boolean;
  onSelect: (tier: string) => void;
  loading?: boolean;
  locale: string;
  selected?: boolean;
  /** Discounted price in cents — when set, original price is struck through */
  discountedPriceCents?: number;
  /** When true, show VND equivalent below the USD price */
  showVnd?: boolean;
  /** Yearly savings percentage (e.g. 17 for 17%). Used in the save badge when billing is annual. */
  yearlySavingsPercent?: number;
}
