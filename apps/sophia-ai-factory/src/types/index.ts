/**
 * Core type definitions for Sophia AI Video Factory
 */

// Tier system - defines customer subscription levels
export type Tier = "BASIC" | "PREMIUM" | "ENTERPRISE";

// Feature flags - toggleable features across the application
export type FeatureFlag =
  | "enable_affiliate_engine"
  | "enable_admin_dashboard"
  | "enable_roi_calculator"
  | "enable_api_integrations"
  | "enable_auto_update";

// User representation (mock for now, will integrate with auth later)
export interface User {
  id: string;
  email: string;
  tier: Tier;
  createdAt: Date;
}

// Tier configuration - defines what each tier can access
export interface TierConfig {
  name: string;
  price: number;
  priceDisplay: string;
  polarProductId?: string;
  recommended?: boolean;
  features: FeatureFlag[];
  limits: {
    // Service limits (from tiers.ts)
    youtubeChannels: number;
    videoTemplates: number;
    trainingSessions: number;
    supportMonths: number;
    automationScripts?: boolean;
    affiliateDashboard?: boolean;
    seoOptimization?: boolean;
    monthlyStrategyCalls?: boolean;

    // SaaS limits (optional for now)
    affiliatePrograms?: number;
    monthlyReports?: boolean;
    apiAccess?: boolean;
    support?: "email" | "email-chat" | "priority-24-7";
  };
}

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

// Feature access check result
export interface AccessCheck {
  hasAccess: boolean;
  reason?: string;
  requiredTier?: Tier;
}

// --- Persistence Types (Airtable) ---

export type ScriptStatus = "draft" | "generated" | "approved" | "voice_generating" | "voice_ready" | "video_generating" | "video_ready" | "published";

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
