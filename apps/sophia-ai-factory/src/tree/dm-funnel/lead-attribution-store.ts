/**
 * @file lead-attribution-store.ts
 * @description Cloudflare D1 store for DM leads and attribution ledger
 * @layer tree
 */

import { createServerClient } from '@/seed/db/client';
import type { DmLead, DmConversionLedger } from '@/seed/types/live-stream-newsjack-dm-types';

interface DmLeadRow {
  id: string;
  platform: string;
  platform_user_id: string;
  platform_username: string | null;
  source_video_id: string | null;
  source_comment_id: string | null;
  initial_intent: string | null;
  funnel_state: string;
  assigned_offer_id: string | null;
  lead_score: number;
  opted_out: number;
  created_at: number;
  updated_at: number;
}

export async function insertDmLead(lead: DmLead): Promise<void> {
  const db = createServerClient();
  await db.prepare(`
    INSERT INTO dm_leads (
      id, platform, platform_user_id, platform_username, source_video_id,
      source_comment_id, initial_intent, funnel_state, assigned_offer_id,
      lead_score, opted_out, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      funnel_state = excluded.funnel_state,
      lead_score = excluded.lead_score,
      opted_out = excluded.opted_out,
      updated_at = excluded.updated_at
  `).bind(
    lead.id,
    lead.platform,
    lead.platformUserId,
    lead.platformUsername ?? null,
    lead.sourceVideoId ?? null,
    lead.sourceCommentId ?? null,
    lead.initialIntent ?? null,
    lead.funnelState,
    lead.assignedOfferId ?? null,
    lead.leadScore,
    lead.optedOut,
    lead.createdAt,
    lead.updatedAt,
  ).run();
}

export async function insertConversionLedger(ledger: DmConversionLedger): Promise<void> {
  const db = createServerClient();
  await db.prepare(`
    INSERT INTO dm_conversion_ledger (
      id, lead_id, offer_id, click_id, sub_id, utm_campaign,
      affiliate_network, status, payout_amount_cents, currency,
      postback_payload, converted_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    ledger.id,
    ledger.leadId,
    ledger.offerId,
    ledger.clickId,
    ledger.subId,
    ledger.utmCampaign ?? null,
    ledger.affiliateNetwork,
    ledger.status,
    ledger.payoutAmountCents,
    ledger.currency,
    ledger.postbackPayload ?? null,
    ledger.convertedAt ?? null,
    ledger.createdAt,
  ).run();
}

export async function listRecentDmLeads(limit: number = 20): Promise<DmLead[]> {
  const db = createServerClient();
  const rows = await db.prepare(`
    SELECT * FROM dm_leads ORDER BY updated_at DESC LIMIT ?
  `).bind(limit).all<DmLeadRow>();

  return (rows.results || []).map((r) => ({
    id: r.id,
    platform: r.platform as DmLead['platform'],
    platformUserId: r.platform_user_id,
    platformUsername: r.platform_username ?? undefined,
    sourceVideoId: r.source_video_id ?? undefined,
    sourceCommentId: r.source_comment_id ?? undefined,
    initialIntent: r.initial_intent ?? undefined,
    funnelState: r.funnel_state as DmLead['funnelState'],
    assignedOfferId: r.assigned_offer_id ?? undefined,
    leadScore: r.lead_score,
    optedOut: r.opted_out,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
