/**
 * Purchase, script, video, and campaign types
 */

import type { Tier } from './tier-core';

// Affiliate Program - represents a partner program in the discovery engine
export interface AffiliateProgram {
  id: string;
  name: string;
  category: string;
  commission: string;
  commissionType: "recurring" | "one-time" | "hybrid";
  cookieDuration: number; // in days
  payoutTerms: string;
  epc: number; // Earnings Per Click
  link: string;
  description?: string;
  tags?: string[];
  tier?: Tier; // Minimum tier required to access this program
}

// --- Persistence Types (Airtable) ---

export type ScriptStatus = "draft" | "generated" | "approved" | "voice_generating" | "voice_ready" | "video_queued" | "video_generating" | "video_ready" | "published";

export interface ScriptRecord {
  id?: string;
  topic: string;
  content: string;
  status: ScriptStatus;
  tier: Tier;
  userId: string;
  createdAt: string;
  audioUrl?: string;
  videoUrl?: string;
  updatedAt?: string;
}

export interface VideoRecord {
  id?: string;
  scriptId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  platform: "youtube" | "tiktok" | "instagram";
  status: "processing" | "completed" | "failed";
  stats?: {
    views: number;
    likes: number;
    shares: number;
  };
  createdAt: string;
}

// --- One-Time Purchase Types ---

/** Discriminated kind for purchase classification */
export type PurchaseKind = 'subscription' | 'one_time';

/** One-Time SKU identifiers */
export type OneTimeSkuId = 'STARTER_BUNDLE';

/** Purchase status lifecycle */
export type PurchaseStatus = 'pending' | 'paid' | 'refunded' | 'failed';

/** Row shape for user_purchases table */
export interface UserPurchase {
  id: string;
  user_id: string;
  kind: PurchaseKind;
  sku: OneTimeSkuId | string;
  payment_id: string;
  invoice_id?: string | null;
  amount_cents: number;
  credits_total: number;
  credits_remaining: number;
  expires_at?: number | null;
  status: PurchaseStatus;
  created_at: number;
  paid_at?: number | null;
  refunded_at?: number | null;
  updated_at: number;
}

/** One-Time SKU catalog entry */
export interface OneTimeSku {
  id: OneTimeSkuId;
  invoiceId: string;
  priceUsd: number;
  credits: number;
  ttlMonths: number;
  label_vi: string;
  label_en: string;
}

// --- Campaign Automation Types (Supabase) ---

export type CampaignStatus = 'draft' | 'queued' | 'processing_script' | 'processing_video' | 'completed' | 'failed';

export interface Campaign {
  id: string;
  user_id: string;
  title: string;
  topic?: string | null;
  audience?: string | null;
  status: CampaignStatus;
  progress: number;
  error_message?: string | null;
  script_content?: Record<string, unknown> | null;
  audio_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  template_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** Filter for campaign list views */
export type CampaignFilter = CampaignStatus | 'all';
