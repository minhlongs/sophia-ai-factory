/**
 * planetary-swarm-v3-coordinator.ts — Gate 11 Planetary Swarm 3.0 Coordinator
 * Layer: TREE (Business Logic)
 *
 * Coordinates trans-continental autonomous agent mesh nodes,
 * enforces Byzantine Fault Tolerant consensus with sub-10ms heartbeats,
 * and matches agentic spot compute auction orders.
 */

import { createHash } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import {
  SWARM_V3_CONSTANTS,
  type PlanetarySwarmNode,
  type SwarmContinent,
  type AgenticSpotAuction,
  type SpotBidRequest,
  type SpotAuctionMatchResult,
  rowToPlanetarySwarmNode,
} from '@/seed/types/planetary-swarm';

export interface PartitionHealthReport {
  totalNodes: number;
  onlineNodes: number;
  partitionedNodes: number;
  isByzantineQuorumMaintained: boolean;
  averageHeartbeatLatencyMs: number;
  continentsRepresented: SwarmContinent[];
}

export class PlanetarySwarmV3Coordinator {
  /**
   * Calculates Byzantine Quorum satisfaction across the planetary mesh.
   * Requires online validators > 2/3 of total registered validators.
   */
  public static evaluateByzantineQuorum(nodes: PlanetarySwarmNode[]): PartitionHealthReport {
    const validators = nodes.filter((n) => n.consensusRole === 'VALIDATOR');
    const totalNodes = validators.length;
    const onlineNodes = validators.filter((n) => n.status === 'ONLINE').length;
    const partitionedNodes = validators.filter((n) => n.status === 'PARTITIONED' || n.status === 'DEGRADED').length;

    const requiredQuorum = Math.floor(totalNodes * SWARM_V3_CONSTANTS.BYZANTINE_QUORUM_RATIO) + 1;
    const isByzantineQuorumMaintained = totalNodes === 0 || onlineNodes >= requiredQuorum;

    const totalLatency = nodes.reduce((sum, n) => sum + n.heartbeatLatencyMs, 0);
    const avgLatency = nodes.length > 0 ? Math.round(totalLatency / nodes.length) : 0;

    const continents = Array.from(new Set(nodes.filter((n) => n.status === 'ONLINE').map((n) => n.continent)));

    return {
      totalNodes,
      onlineNodes,
      partitionedNodes,
      isByzantineQuorumMaintained,
      averageHeartbeatLatencyMs: avgLatency,
      continentsRepresented: continents,
    };
  }

  /**
   * Clears an agentic spot compute auction batch: matches a buyer request
   * with the lowest-latency, eligible seller node in the planetary mesh.
   */
  public static matchSpotComputeAuction(
    nodes: PlanetarySwarmNode[],
    bid: SpotBidRequest,
    batchId?: string
  ): SpotAuctionMatchResult {
    // Eligible seller nodes must be ONLINE and have acceptable latency
    const eligibleNodes = nodes
      .filter((n) => n.status === 'ONLINE' && n.heartbeatLatencyMs <= SWARM_V3_CONSTANTS.SUB_10MS_PLANETARY_HEARTBEAT * 3)
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
    // Clearing price determined by spot supply (discounted by 10% from buyer max if ample supply)
    const discountFactor = eligibleNodes.length > 3 ? 0.9 : 1.0;
    const clearingPriceMicros = Math.floor(bid.maxPriceMicros * discountFactor);

    // Calculate total cost in USD cents: (priceMicros * units * durationSec) / (3600 * 10,000)
    const costCents = Math.max(
      1,
      Math.floor((clearingPriceMicros * bid.unitsRequested * bid.durationSeconds) / (3600 * 10_000))
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
  public static healPartitionedNodes(nodes: PlanetarySwarmNode[]): PlanetarySwarmNode[] {
    return nodes.map((n) => {
      if (n.status === 'PARTITIONED' || n.status === 'DEGRADED') {
        return {
          ...n,
          status: 'ONLINE',
          heartbeatLatencyMs: Math.min(n.heartbeatLatencyMs, SWARM_V3_CONSTANTS.SUB_10MS_PLANETARY_HEARTBEAT),
          lastHeartbeatAt: new Date().toISOString(),
        };
      }
      return n;
    });
  }

  /**
   * Persists a planetary swarm node into Cloudflare D1.
   */
  public static async persistNode(db: D1Database, node: PlanetarySwarmNode): Promise<void> {
    await db
      .prepare(
        `INSERT OR REPLACE INTO planetary_swarm_nodes (
          id, node_key, continent, datacenter_code, ip_address_hash,
          ed25519_public_key, status, consensus_role, heartbeat_latency_ms,
          uptime_percentage, last_heartbeat_at, registered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        node.id,
        node.nodeKey,
        node.continent,
        node.datacenterCode,
        node.ipAddressHash,
        node.ed25519PublicKey,
        node.status,
        node.consensusRole,
        node.heartbeatLatencyMs,
        node.uptimePercentage,
        node.lastHeartbeatAt,
        node.registeredAt
      )
      .run();
  }

  /**
   * Fetches all registered planetary nodes from Cloudflare D1.
   */
  public static async getAllNodes(db: D1Database): Promise<PlanetarySwarmNode[]> {
    const { results } = await db.prepare('SELECT * FROM planetary_swarm_nodes').all<Record<string, unknown>>();
    return results.map(rowToPlanetarySwarmNode);
  }

  /**
   * Records a settled spot compute auction into Cloudflare D1.
   */
  public static async recordAuction(db: D1Database, auction: AgenticSpotAuction): Promise<void> {
    await db
      .prepare(
        `INSERT INTO agentic_spot_auctions (
          id, auction_batch_id, seller_node_id, buyer_agent_did,
          resource_type, units_allocated, clearing_price_micros,
          settlement_currency, duration_seconds, bid_proof_hash,
          settlement_status, executed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        auction.id,
        auction.auctionBatchId,
        auction.sellerNodeId,
        auction.buyerAgentDid,
        auction.resourceType,
        auction.unitsAllocated,
        auction.clearingPriceMicros,
        auction.settlementCurrency,
        auction.durationSeconds,
        auction.bidProofHash,
        auction.settlementStatus,
        auction.executedAt
      )
      .run();
  }
}
