/**
 * Handover domain types — shared between wizard, API, doc generator.
 * @module lib/handover/handover-types
 */

import type { Tier } from '@/seed/types';

export type AgencyType = 'b2b_saas' | 'ecom' | 'content_creator' | 'service' | 'other';

export type HandoverStatus = 'pending' | 'active' | 'at_risk' | 'churned';

export type HandoverSource = 'manual' | 'auto_payment' | 'auto_signup';

/** Row from customer_handovers D1 table */
export interface CustomerHandoverRow {
  id: string;
  customer_user_id: string;
  agency_name: string;
  agency_type: AgencyType | null;
  tier: Tier;
  starter_sops: string | null; // JSON array
  magic_link_token: string | null;
  magic_link_expires_at: number | null;
  created_by_admin_id: string;
  created_at: number;
  welcome_email_sent_at: number | null;
  customer_first_login_at: number | null;
  customer_first_sop_install_at: number | null;
  customer_first_run_at: number | null;
  status: HandoverStatus;
  source: HandoverSource;
  trigger_payment_id: string | null;
}

/** Input for creating a new handover */
export interface CreateHandoverInput {
  agencyName: string;
  ownerEmail: string;
  ownerFullName: string;
  agencyType: AgencyType;
  tier: Tier;
  phone?: string;
  locale?: string;
  timezone?: string;
  referralSource?: string;
  selectedSops: string[]; // SOP slugs
}

/** SOP suggestion config per agency_type */
export interface SopSuggestion {
  slug: string;
  nameVi: string;
  nameEn: string;
  descriptionEn: string;
}

/** Tier MCU limits for display */
export const TIER_MCU_LIMITS: Record<Tier, number> = {
  BASIC: 1000,
  PREMIUM: 5000,
  ENTERPRISE: 20000,
  MASTER: 100000,
};

/** SOPs per tier (max pre-install count) */
export const TIER_SOP_COUNTS: Record<Tier, number> = {
  BASIC: 3,
  PREMIUM: 8,
  ENTERPRISE: 15,
  MASTER: 25,
};

/** Suggested SOPs by agency type */
export const AGENCY_SOP_MAP: Record<AgencyType, string[]> = {
  b2b_saas: [
    'proposal-auto-pilot',
    'weekly-newsletter',
    'post-demo-followup',
    'lead-enrichment',
    'weekly-perf-report',
    'mention-monitor',
    'onboarding-video',
    'customer-success-check',
  ],
  ecom: [
    'abandoned-cart',
    'multi-channel-crosspost',
    'anomaly-alerts',
    'daily-tiktok',
    'daily-instagram-reels',
    'product-review-responder',
    'weekly-newsletter',
    'flash-sale-alert',
  ],
  content_creator: [
    'daily-tiktok',
    'daily-instagram-reels',
    'weekly-youtube',
    'evergreen-recycle',
    'weekly-newsletter',
    'mention-monitor',
    'content-calendar',
    'audience-insights',
  ],
  service: [
    'proposal-auto-pilot',
    'post-demo-followup',
    'weekly-perf-report',
    'lead-enrichment',
    'mention-monitor',
    'weekly-newsletter',
    'client-check-in',
    'case-study-generator',
  ],
  other: [
    'weekly-newsletter',
    'daily-tiktok',
    'proposal-auto-pilot',
    'lead-enrichment',
    'mention-monitor',
    'weekly-perf-report',
    'multi-channel-crosspost',
    'anomaly-alerts',
  ],
};
