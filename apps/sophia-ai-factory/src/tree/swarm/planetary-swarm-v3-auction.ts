/**
 * planetary-swarm-v3-auction.ts — Spot compute auction matching and partition healing
 * Layer: TREE (Business Logic)
 */

import { createHash } from 'node:crypto';
import {
  SWARM_V3_CONSTANTS,
  type PlanetarySwarmNode,
  type SpotBidRequest,
  type SpotAuctionMatchResult,
} from '@/seed/types/planetary-swarm';

/**
 * Clears an agentic spot compute auction batch: matches a buyer request
 * with the lowest-latency, eligible seller node in the planetary mesh.
 */
export function matchSpotComputeAuctionBatch(
  nodes: PlanetarySwarmNode[],
  bid: SpotBidRequest,
  batchId?: string,
): SpotAuctionMatchResult {
  const eligibleNodes = nodes
    .filter(
      (n) =>
        n.status === 'ONLINE' &&
        n.heartbeatLatencyMs <= SWARM_V3_CONSTANTS.SUB_10MS_PLANETARY_HEARTBEAT * 3,
    )
    .sort((a, b) => a.heartbeatLatencyMs - b.heartbeatLatencyMs);

  if (eligibleNodes.length === 0) {
    return {
      auctionId: `spot_reject_${Date.now()}`,
      sellerNodeId: '',
      clearingPriceMicros: 0,
      unitsAllocated: 0,
      totalCostUsdCents: 0,
      status: 'DISPUTED',
      bidProofHash: '',
    };
  }

  const selectedSeller = eligibleNodes[0];
  const discountFactor = eligibleNodes.length > 3 ? 0.9 : 1.0;
  const clearingPriceMicros = Math.floor(bid.maxPriceMicros * discountFactor);

  const costCents = Math.max(
    1,
    Math.floor(
      (clearingPriceMicros * bid.unitsRequested * bid.durationSeconds) / (3600 * 10_000),
    ),
  );

  const bId = batchId || `batch_${Date.now()}`;
  const proofPayload = `${bId}:${selectedSeller.id}:${bid.buyerAgentDid}:${clearingPriceMicros}:${bid.unitsRequested}`;
  const bidProofHash = createHash('sha256').update(proofPayload).digest('hex');

  return {
    auctionId: `spot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sellerNodeId: selectedSeller.id,
    clearingPriceMicros,
    unitsAllocated: bid.unitsRequested,
    totalCostUsdCents: costCents,
    status: 'SETTLED',
    bidProofHash,
  };
}

/**
 * Simulates partition healing: restores partitioned nodes back to ONLINE status
 * when cross-continental telemetry links recover.
 */
export function healPlanetaryPartitionedNodes(
  nodes: PlanetarySwarmNode[],
): PlanetarySwarmNode[] {
  return nodes.map((n) => {
    if (n.status === 'PARTITIONED' || n.status === 'DEGRADED') {
      return {
        ...n,
        status: 'ONLINE',
        heartbeatLatencyMs: Math.min(
          n.heartbeatLatencyMs,
          SWARM_V3_CONSTANTS.SUB_10MS_PLANETARY_HEARTBEAT,
        ),
        lastHeartbeatAt: new Date().toISOString(),
      };
    }
    return n;
  });
}
