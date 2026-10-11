import { tryCreateServerClientSync, D1Client } from '@/seed/db/client';
import { Tier } from '@/seed/types';

export interface CampaignRow {
  id: string;
  title: string;
  status: string | null;
  progress: number | null;
  created_at: string;
  updated_at: string;
}

export const ACTIVE_STATUSES = ['queued', 'processing_script', 'processing_video'] as const;

export const MAX_CAMPAIGN_LIST_ROWS = 10;
export const MAX_CAMPAIGN_TITLE_LEN = 80;
export const MAX_CAMPAIGN_MESSAGE_LEN = 3800;

let _campaignDb: D1Client | null = null;

export function resetCampaignDb(): void {
  _campaignDb = null;
}

export function getCampaignDb(): D1Client | null {
  if (!_campaignDb) _campaignDb = tryCreateServerClientSync();
  return _campaignDb;
}

// Helper to map Supabase subscription tier to App Tier
export function mapSubscriptionToTier(subTier: 'free' | 'pro' | 'enterprise' | null): Tier {
  switch (subTier) {
    case 'pro': return 'PREMIUM';
    case 'enterprise': return 'ENTERPRISE';
    case 'free':
    default: return 'BASIC';
  }
}
