/**
 * OPC Gate 1 Pre-Flight Readiness Evaluator (Read-Only, $0.00 Spend).
 *
 * Inspects all Gate 1 prerequisites for a workspace without invoking any
 * external paid API or exposing any secret/token value. Fails closed prior to
 * reading workspace tables when the caller lacks ADMIN/OWNER authorization.
 *
 * Layer: tree/affiliate/readiness
 * @module tree/affiliate/readiness/opc-gate1-readiness
 */

import { hasWorkspaceRole } from '@/seed/auth/workspace-access';
import { listUserApiKeyProviders } from '@/tree/byok/user-api-key-store';
import { getAffiliateKillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';
import { evaluateOfferRow } from '@/tree/affiliate/offers/offer-eligibility';
import { evaluateJurisdictionCompliance } from '@/tree/video/compliance/jurisdiction-compliance-guard';

export interface OpcGate1ReadinessReport {
  workspaceId: string;
  userId: string;
  adminAuthorized: boolean;
  killSwitchReady: boolean;
  killSwitchState: { active: boolean; known: boolean };
  byokProviders: string[];
  voiceByokReady: boolean;
  videoByokReady: boolean;
  youtubeChannelReady: boolean;
  youtubeChannelId: string | null;
  eligibleSaasOfferIds: string[];
  eligibleCryptoOfferIds: string[];
  gate1ReadyForLiveProof: boolean;
  blockers: string[];
}

interface OfferCandidateRow {
  id: string;
  tenant_id?: string | null;
  network_id?: string | null;
  external_id?: string | null;
  product_url?: string | null;
  destination_url?: string | null;
  status?: string | null;
  commission_terms?: string | null;
  niche?: string | null;
  region?: string | null;
  category?: string | null;
}

async function listEligibleOffersByNiche(db: D1Database, workspaceId: string) {
  const saas: string[] = [];
  const crypto: string[] = [];
  try {
    const rows = await db
      .prepare(
        `SELECT id, tenant_id, network_id, external_id, product_url, destination_url,
                status, commission_terms, niche, region, category
         FROM affiliate_offers WHERE tenant_id IN ('system', ?) AND status = 'active'`,
      )
      .bind(workspaceId)
      .all<OfferCandidateRow>();
    for (const row of rows.results ?? []) {
      const url = row.product_url || row.destination_url || '';
      const isCrypto = row.niche === 'crypto_global' || (row.category ?? '').toLowerCase().includes('crypto');
      const targetNiche = isCrypto ? 'crypto_global' : 'saas_global';
      const jurisdiction = row.region ?? (targetNiche === 'saas_global' ? 'GLOBAL' : '');
      if (!evaluateJurisdictionCompliance(targetNiche, jurisdiction).isAllowed) continue;
      const checked = evaluateOfferRow(row, { tenantId: workspaceId, offerId: row.id, productUrl: url, niche: targetNiche, jurisdiction });
      if (checked.ok) (targetNiche === 'crypto_global' ? crypto : saas).push(row.id);
    }
  } catch {
    // Non-fatal; blockers recorded by caller
  }
  return { saas, crypto };
}

export async function evaluateOpcGate1Readiness(deps: {
  db: D1Database;
  workspaceId: string;
  userId: string;
}): Promise<OpcGate1ReadinessReport> {
  const { db, workspaceId, userId } = deps;
  const isPersonalOwnerWorkspace = Boolean(workspaceId && userId && workspaceId === userId);
  const adminAuthorized =
    isPersonalOwnerWorkspace || (await hasWorkspaceRole(workspaceId, userId, 'ADMIN', db));
  if (!adminAuthorized) {
    return {
      workspaceId, userId, adminAuthorized: false, killSwitchReady: false,
      killSwitchState: { active: true, known: false }, byokProviders: [],
      voiceByokReady: false, videoByokReady: false, youtubeChannelReady: false,
      youtubeChannelId: null, eligibleSaasOfferIds: [], eligibleCryptoOfferIds: [],
      gate1ReadyForLiveProof: false, blockers: ['WORKSPACE_ADMIN_REQUIRED'],
    };
  }

  const blockers: string[] = [];
  const killSwitchState = await getAffiliateKillSwitchState(workspaceId).catch(() => ({ active: true, known: false }));
  const killSwitchReady = !killSwitchState.active && killSwitchState.known;
  if (!killSwitchReady) blockers.push('KILL_SWITCH_ACTIVE_OR_UNKNOWN');

  const byokProviders = (await listUserApiKeyProviders(userId).catch(() => [])).map((p) => String(p).toLowerCase());
  const voiceByokReady = byokProviders.includes('elevenlabs');
  const videoByokReady = ['heygen', 'd-id', 'did', 'muapi'].some((p) => byokProviders.includes(p));
  if (!voiceByokReady) blockers.push('BYOK_VOICE_MISSING');
  if (!videoByokReady) blockers.push('BYOK_VIDEO_MISSING');

  const ch = await db
    .prepare(
      `SELECT id, access_token FROM publishing_channels
       WHERE tenant_id = ? AND provider = 'youtube' AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(workspaceId)
    .first<{ id: string; access_token: string | null }>()
    .catch(() => null);
  const youtubeChannelId = ch?.id && ch.access_token ? ch.id : null;
  const youtubeChannelReady = Boolean(youtubeChannelId);
  if (!youtubeChannelReady) blockers.push('YOUTUBE_CHANNEL_MISSING');

  const { saas: eligibleSaasOfferIds, crypto: eligibleCryptoOfferIds } = await listEligibleOffersByNiche(db, workspaceId);
  if (eligibleSaasOfferIds.length === 0) blockers.push('SAAS_OFFER_MISSING');
  if (eligibleCryptoOfferIds.length === 0) blockers.push('CRYPTO_OFFER_MISSING');

  return {
    workspaceId, userId, adminAuthorized: true, killSwitchReady, killSwitchState,
    byokProviders, voiceByokReady, videoByokReady, youtubeChannelReady, youtubeChannelId,
    eligibleSaasOfferIds, eligibleCryptoOfferIds, gate1ReadyForLiveProof: blockers.length === 0, blockers,
  };
}
