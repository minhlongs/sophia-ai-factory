/**
 * Anonymized Merchant Proof Snapshot Builder (Phase 1 Clearinghouse Hardening).
 *
 * Aggregates bot-filtered, unique-IP `SERVER_VERIFIED_CLICK` telemetry across
 * Sophia's Phase 1 focus verticals (4 CEXs: Binance, Bybit, OKX, Bitget +
 * 5 AI SaaS brands: Notion, Make, Semrush, ElevenLabs, HeyGen) without exposing
 * tenant PII or BYOK credentials — ready for Master Deal negotiations at 50 users.
 *
 * @module tree/affiliates/merchant-proof-snapshot
 */

export const PHASE1_FOCUS_PROGRAMS = {
  cryptoCex: ['Binance', 'Bybit', 'OKX', 'Bitget'] as const,
  aiSaas: ['Notion AI', 'Make', 'Semrush', 'ElevenLabs', 'HeyGen'] as const,
} as const;

export interface RawClickTelemetryRow {
  readonly linkId: string;
  readonly networkHint: string;
  readonly ipHash: string;
  readonly country?: string | null;
  readonly isBot?: boolean;
}

export interface NetworkClickProof {
  readonly networkHint: string;
  readonly rawClicks: number;
  readonly uniqueVerifiedClicks: number;
  readonly botsFiltered: number;
}

export interface MerchantProofSnapshot {
  readonly generatedAtIso: string;
  readonly totalRawClicks: number;
  readonly totalUniqueVerifiedClicks: number;
  readonly totalBotsFiltered: number;
  readonly byNetwork: readonly NetworkClickProof[];
  readonly stage2TriggerReady: boolean;
}

const STAGE2_UNIQUE_CLICK_THRESHOLD = 25_000;

export function buildMerchantProofSnapshot(
  rows: readonly RawClickTelemetryRow[],
  nowIso = new Date().toISOString(),
): MerchantProofSnapshot {
  const byNet = new Map<string, { raw: number; bots: number; uniqueIps: Set<string> }>();
  const globalUniqueIps = new Set<string>();
  let totalRawClicks = 0;
  let totalBotsFiltered = 0;

  for (const row of rows) {
    const net = row.networkHint.trim().toLowerCase() || 'generic';
    let bucket = byNet.get(net);
    if (!bucket) {
      bucket = { raw: 0, bots: 0, uniqueIps: new Set<string>() };
      byNet.set(net, bucket);
    }

    if (row.isBot) {
      bucket.bots += 1;
      totalBotsFiltered += 1;
      continue;
    }

    bucket.raw += 1;
    totalRawClicks += 1;
    if (row.ipHash) {
      bucket.uniqueIps.add(row.ipHash);
      globalUniqueIps.add(`${row.linkId}:${row.ipHash}`);
    }
  }

  const byNetwork: NetworkClickProof[] = Array.from(byNet.entries())
    .map(([networkHint, stats]) => ({
      networkHint,
      rawClicks: stats.raw,
      uniqueVerifiedClicks: stats.uniqueIps.size,
      botsFiltered: stats.bots,
    }))
    .sort((a, b) => b.uniqueVerifiedClicks - a.uniqueVerifiedClicks);

  return {
    generatedAtIso: nowIso,
    totalRawClicks,
    totalUniqueVerifiedClicks: globalUniqueIps.size,
    totalBotsFiltered,
    byNetwork,
    stage2TriggerReady: globalUniqueIps.size >= STAGE2_UNIQUE_CLICK_THRESHOLD,
  };
}
