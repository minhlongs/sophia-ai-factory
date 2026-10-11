/**
 * Email Executive BI Digest Types & Interfaces
 *
 * Layer: forest
 *
 * @module forest/bi/digest/types
 */

import type { ExecutiveBIMetricsSummary } from '@/seed/types/executive-bi';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import type { WhiteLabelEmailBranding } from '@/tree/branding/email-styler';

export type { ExecutiveBIMetricsSummary, BrandingSettings, WhiteLabelEmailBranding };

export interface EmailDigestOptions {
  to?: string | string[];
  branding?: Partial<BrandingSettings> | WhiteLabelEmailBranding | null;
  periodLabel?: string;
  cadence?: 'weekly' | 'monthly';
  portalUrl?: string;
  additionalNotesHtml?: string;
  locale?: 'vi' | 'en';
}

export interface EmailDigestResult {
  success: boolean;
  messageId?: string;
  recipientCount: number;
  provider: 'resend' | 'dry-run';
  error?: string;
}
