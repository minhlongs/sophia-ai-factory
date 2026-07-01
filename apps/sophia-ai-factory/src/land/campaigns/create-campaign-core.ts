/**
 * Shared campaign creation logic used by:
 * - app/actions/campaigns.ts (server action, D1, session auth)
 * - app/api/v1/campaigns/create/route.ts (API route, Supabase, RaaS API key auth)
 *
 * This module owns the DB insert + Inngest send pattern to avoid duplication.
 */

import { inngest } from '@/tree/inngest/client';
import type { Tier } from "@/seed/types";

export interface CampaignInsertData {
  id?: string;
  user_id: string;
  title: string;
  topic: string | null;
  audience: string | null;
  status: "queued";
  script_content?: Record<string, unknown>;
  template_id?: string | null;
  progress?: number;
}

export interface CampaignInngestData {
  campaignId: string;
  userId: string;
  topic: string;
  audience: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: "script" | "tts" | "video" | "finalize";
  /** Optional A/B experiment ID created alongside the campaign. */
  abExperimentId?: string;
}

/**
 * Send campaign.created event to Inngest.
 * Callers should wrap in try/catch when Inngest may not be configured.
 */
export async function sendCampaignCreatedEvent(data: CampaignInngestData): Promise<void> {
  await inngest.send({
    name: "campaign.created",
    data,
  });
}
