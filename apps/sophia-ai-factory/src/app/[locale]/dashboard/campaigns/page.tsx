/**
 * Campaign Dashboard page — server component.
 * Fetches campaigns and renders the Stitch campaigns screen.
 */

import { createServerClient } from "@/seed/db/client";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { redirect } from "next/navigation";
import { logger } from "@/seed/utils/logger-utility";
import { CampaignsPage as StitchCampaignsPage } from '@/components/stitch/screens/campaigns';
import type { Campaign } from "@/seed/types";

// Campaigns are user-specific but update infrequently — ISR with 60s revalidate
export const revalidate = 60;

type StitchChannel = 'youtube' | 'instagram' | 'tiktok';

interface MappedCampaign {
  id: string;
  title: string;
  status: 'live' | 'paused' | 'draft';
  channel: string;
  channels: StitchChannel[];
  thumbnail: string | null;
  metrics: { views: string; revenue: string; ctr: string };
  progress: number;
  progressLabel: string;
  lastPublished: string;
  action: string;
  actionLabel: string;
}

function toStitchCampaign(c: Campaign): MappedCampaign {
  // Map DB campaign status to Stitch display status
  const displayStatus = c.status === 'completed'
    ? 'live'
    : (c.status === 'draft' ? 'draft' : 'paused');

  return {
    id: c.id,
    title: c.title,
    status: displayStatus,
    channel: 'Faceless YouTube',
    channels: [],
    thumbnail: c.thumbnail_url ?? null,
    metrics: { views: '-', revenue: '-', ctr: '-' },
    progress: c.progress ?? 0,
    progressLabel: 'Campaign Progress',
    lastPublished: c.created_at,
    action: 'View Details',
    actionLabel: 'viewDetails',
  };
}

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  let campaigns: Campaign[] = [];

  if (user) {
    try {
      const db = createServerClient();
      const { data, error } = await db
        .from("campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        logger.error("[campaigns/page] DB error", new Error(error.message));
      }
      campaigns = (data as unknown as Campaign[]) || [];
    } catch (e) {
      logger.error("[campaigns/page] Failed to fetch campaigns", e instanceof Error ? e : new Error(String(e)));
      campaigns = [];
    }
  }

  const stitchedCampaigns = campaigns.map(toStitchCampaign);

  return <StitchCampaignsPage initialCampaigns={stitchedCampaigns} />;
}
