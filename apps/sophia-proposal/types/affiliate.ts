/**
 * Affiliate Engine Types
 *
 * TypeScript interfaces for affiliate_programs, affiliate_content,
 * affiliate_clicks, affiliate_revenue tables + API responses.
 */

// ============================================================================
// CORE TABLE TYPES
// ============================================================================

export type CommissionType = 'recurring' | 'one-time' | 'tiered';
export type ProgramNiche =
  | 'saas'
  | 'marketing'
  | 'design'
  | 'dev-tools'
  | 'productivity'
  | 'ecommerce'
  | 'finance'
  | 'security'
  | 'analytics';

export interface AffiliateProgram {
  id: string;
  name: string;
  company: string;
  url: string;
  signup_url: string | null;
  commission_rate: number; // percentage e.g. 30.0
  commission_type: CommissionType;
  cookie_duration_days: number;
  payout_threshold: number;
  payout_frequency: string; // 'monthly', 'weekly', 'quarterly'
  niche: ProgramNiche;
  description: string | null;
  logo_url: string | null;
  score: number; // 0-100 computed
  is_active: boolean;
  source: 'manual' | 'scraper' | 'affitor' | 'partnerstack';
  external_id: string | null;
  metadata: Record<string, unknown>;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

// Shape for creating/upserting (no id, score, timestamps)
export type AffiliateProgramInput = Omit<
  AffiliateProgram,
  'id' | 'score' | 'created_at' | 'updated_at' | 'last_scraped_at'
> & {
  last_scraped_at?: string;
};

export type ContentType = 'blog' | 'video' | 'social' | 'comparison';
export type ContentStatus = 'draft' | 'generating' | 'ready' | 'published' | 'failed';

export interface AffiliateContent {
  id: string;
  org_id: string;
  program_id: string;
  content_type: ContentType;
  title: string;
  body: string | null;
  status: ContentStatus;
  mcu_cost: number;
  video_asset_id: string | null;
  published_url: string | null;
  affiliate_link: string; // tracked link with UTM
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AffiliateClick {
  id: string;
  content_id: string | null;
  program_id: string;
  ip_hash: string | null; // SHA-256 of IP
  user_agent: string | null;
  referrer: string | null;
  country: string | null;
  created_at: string;
}

export type RevenueStatus = 'pending' | 'confirmed' | 'paid';

export interface AffiliateRevenue {
  id: string;
  org_id: string;
  program_id: string;
  content_id: string | null;
  amount: number;
  currency: string;
  status: RevenueStatus;
  period_month: string | null; // '2026-03'
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ProgramsListResponse {
  programs: AffiliateProgram[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProgramsListParams {
  niche?: ProgramNiche;
  min_score?: number;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

export interface ScrapeResult {
  inserted: number;
  updated: number;
  top_programs: AffiliateProgram[];
  errors: string[];
}

// Raw program shape before scoring/normalization
export interface RawProgram {
  name: string;
  company: string;
  url: string;
  signup_url?: string;
  commission_rate: number; // percentage
  commission_type: CommissionType;
  cookie_duration_days: number;
  payout_threshold: number;
  payout_frequency: string;
  niche: ProgramNiche;
  description?: string;
  logo_url?: string;
  source: AffiliateProgram['source'];
  external_id?: string;
  metadata?: Record<string, unknown>;
}
