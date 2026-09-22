/**
 * Shared types for Telegram Automated Sales & Lead Qualification Engine
 * Milestone M2 (Requirement R2)
 * @module seed/types/telegram-sales
 */

export type LeadStatus =
  | 'new'
  | 'survey_started'
  | 'demo_sent'
  | 'checkout_initiated'
  | 'paid'
  | 'unresponsive';

export type BudgetTier = 'low' | 'mid' | 'high';

export type SalesNiche =
  | 'ai_agency'
  | 'ecommerce'
  | 'solopreneur'
  | 'real_estate'
  | 'beauty'
  | 'other';

export interface TelegramLeadRow {
  id: string;
  telegram_chat_id: string;
  username: string | null;
  first_name: string | null;
  status: LeadStatus;
  source_utm: string | null;
  campaign_id: string | null;
  referrer_id: string | null;
  niche: string | null;
  budget_tier: BudgetTier | null;
  qualification_score: number;
  demo_video_sent_at: string | null;
  promo_code_offered: string | null;
  payment_method_selected: 'nowpayments' | 'payos' | null;
  checkout_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadRecord = TelegramLeadRow;

export interface LeadSurveyInput {
  chatId: string;
  firstName?: string;
  username?: string;
  niche?: string;
  budgetTier?: BudgetTier;
  startPayload?: string;
  sourceUtm?: string;
}

export interface LeadAlertPayload {
  chatId: string;
  firstName: string;
  username?: string;
  niche: string;
  budgetTier: BudgetTier | string;
  leadScore: number;
  sourceUtm?: string;
  campaignId?: string;
}

export interface PaymentAlertPayload {
  customerName: string;
  email?: string;
  tier: string;
  amountUsd: number;
  amountVnd?: number;
  provider: 'nowpayments' | 'payos';
  promoCode?: string;
  paymentId: string;
  orderId?: string;
  currentMrr?: number;
  customerIndex?: number;
}
