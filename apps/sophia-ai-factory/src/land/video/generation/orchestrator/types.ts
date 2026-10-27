import type { Tier } from '@/seed/types';

export interface Step {
  sleep(name: string, duration: string): Promise<void>;
  run<T>(name: string, fn: () => Promise<T>): Promise<unknown>;
}

export interface RunCampaignWorkflowArgs {
  campaignId: string;
  userId: string;
  topic: string;
  audience: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  abVariantACaption?: string;
  abExperimentId?: string;
  step: Step;
  updateStatus: (status: string, progress: number, data?: Record<string, unknown>) => Promise<void>;
  notifyUser: (message: string) => Promise<void>;
}

export interface AffiliateOfferSelectedRow {
  short_code: string;
  offer_id?: string | null;
  offer_name: string;
  affiliate_link: string;
  network: string;
  category?: string | null;
}

export interface AffiliateOfferResult {
  productName: string;
  shortUrl: string;
  /** Catalog category, used to classify the compliance vertical. */
  category?: string | null;
}

/**
 * Record of the disclosure that actually accompanied a published description.
 *
 * Persisted with the distribution step's checkpoint so that "the disclosure was
 * required" and "the disclosure was emitted" are two separately auditable facts.
 * A regulated video that was allowed to publish only because a disclaimer went
 * out must leave proof that it did.
 */
export interface DisclosureRecord {
  /** Resolved compliance vertical of the offer that was distributed. */
  vertical: string;
  /** Jurisdiction the publish was gated on; null when no offer was attached. */
  jurisdiction: string | null;
  /** Whether the mandated financial disclaimer wording was emitted. */
  financialDisclaimerEmitted: boolean;
  /** Whether the mandated affiliate disclosure wording was emitted. */
  affiliateDisclosureEmitted: boolean;
  /** Language the disclosure wording was emitted in. */
  locale: 'en' | 'vi';
}
