export type {
  ViralFunnelOverview,
  ViralVideoFunnelItem,
  ViralNiche,
  HookArchetype,
  ViralPlatform,
} from '@/seed/types/growth';

export interface ViralFunnelLinkRow {
  video_id: string;
  platform: string;
  hook_archetype: string;
  target_niche: string;
  views_count: number;
  clicks_count: number;
  leads_count: number;
  conversions_count: number;
  revenue_usd: number;
  created_at: number;
}

export interface VideoAnalyticsRow {
  video_id: string;
  title: string | null;
  platform: string | null;
  views: number | null;
  clicks: number | null;
}
