/**
 * Growth & Funnel Domain Types — Funnel & Attribution
 *
 * @module seed/types/growth/funnel
 */

import type { HookArchetype, ViralNiche, ViralPlatform } from './viral-video';

export interface ViralVideoFunnelItem {
  videoId: string;
  videoTitle: string;
  niche: ViralNiche;
  platform: ViralPlatform | 'all';
  hookArchetype: HookArchetype;
  views: number;
  ctaClicks: number;
  ctrPct: number;
  leadsCount: number;
  conversionCount: number;
  revenueUsd: number;
  status: 'active' | 'viral' | 'needs_optimization';
  publishedAt: string;
}

export interface ViralFunnelOverview {
  totalVideos: number;
  totalViews: number;
  totalCtaClicks: number;
  averageCtrPct: number;
  totalLeads: number;
  totalConversions: number;
  totalRevenueUsd: number;
  topPerformingNiche: ViralNiche;
  topPerformingHook: HookArchetype;
  items: ViralVideoFunnelItem[];
}

export interface ViralFunnelLink {
  id: string;
  videoId: string;
  platform: ViralPlatform;
  destinationUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  shortCode?: string;
  clicksCount: number;
  leadsCount: number;
  conversionsCount: number;
  affiliatePartnerId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ViralFunnelLinkRow {
  id: string;
  video_id: string;
  platform: string;
  destination_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  short_code: string | null;
  clicks_count: number;
  leads_count: number;
  conversions_count: number;
  affiliate_partner_id: string | null;
  created_at: number;
  updated_at: number;
}
