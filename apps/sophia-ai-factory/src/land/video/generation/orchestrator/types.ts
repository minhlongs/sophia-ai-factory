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
  offer_name: string;
  affiliate_link: string;
}

export interface AffiliateOfferResult {
  productName: string;
  shortUrl: string;
}
