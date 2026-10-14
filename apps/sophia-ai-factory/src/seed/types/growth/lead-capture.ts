/**
 * Growth & Funnel Domain Types — Lead Capture & Qualification
 *
 * @module seed/types/growth/lead-capture
 */

export type GrowthLeadSource =
  | 'telegram_bot'
  | 'viral_video'
  | 'seo_landing'
  | 'affiliate'
  | 'direct';

export type GrowthLeadStatus =
  | 'new'
  | 'qualified'
  | 'demo_sent'
  | 'checkout_opened'
  | 'converted'
  | 'lost';

export interface GrowthLead {
  id: string;
  source: GrowthLeadSource;
  telegramChatId?: string;
  telegramUsername?: string;
  niche?: string;
  budget?: string;
  leadScore: number; // 0-100
  status: GrowthLeadStatus;
  utmSource?: string;
  utmCampaign?: string;
  affiliatePartnerId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GrowthLeadRow {
  id: string;
  source: string;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  niche: string | null;
  budget: string | null;
  lead_score: number;
  status: string;
  utm_source: string | null;
  utm_campaign: string | null;
  affiliate_partner_id: string | null;
  created_at: number;
  updated_at: number;
}

export type TelegramLeadStatus =
  | 'new'
  | 'qualified'
  | 'demo_sent'
  | 'checkout_sent'
  | 'converted'
  | 'lost';

export interface TelegramLead {
  id: string;
  chatId: string;
  username?: string;
  firstName?: string;
  niche?: string;
  budget?: string;
  qualificationScore: number;
  status: TelegramLeadStatus;
  metadataJson?: string;
  affiliatePartnerId?: string;
  createdAt: string;
  updatedAt?: string;
}
