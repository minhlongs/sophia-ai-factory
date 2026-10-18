/**
 * planetary-swarm-v3-coordinator.ts — Gate 11 Planetary Swarm 3.0 Coordinator
 * Layer: TREE (Business Logic)
 *
 * Coordinates trans-continental autonomous agent mesh nodes,
 * enforces Byzantine Fault Tolerant consensus with sub-10ms heartbeats,
 * and matches agentic spot compute auction orders.
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  SWARM_V3_CONSTANTS,
  type PlanetarySwarmNode,
  type SwarmContinent,
  type AgenticSpotAuction,
  type SpotBidRequest,
  type SpotAuctionMatchResult,
} from '@/seed/types/planetary-swarm';
import {
  persistPlanetarySwarmNode,
  getAllPlanetarySwarmNodes,
  recordPlanetarySpotAuction,
} from './planetary-swarm-v3-persistence';
import {
  matchSpotComputeAuctionBatch,
  healPlanetaryPartitionedNodes,
} from './planetary-swarm-v3-auction';

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
    return matchSpotComputeAuctionBatch(nodes, bid, batchId);
  }

  /**
   * Simulates partition healing: restores partitioned nodes back to ONLINE status
   * when cross-continental telemetry links recover.
   */
  public static healPartitionedNodes(nodes: PlanetarySwarmNode[]): PlanetarySwarmNode[] {
    return healPlanetaryPartitionedNodes(nodes);
  }

  /**
   * Persists a planetary swarm node into Cloudflare D1.
   */
  public static async persistNode(db: D1Database, node: PlanetarySwarmNode): Promise<void> {
    return persistPlanetarySwarmNode(db, node);
  }

  /**
   * Fetches all registered planetary nodes from Cloudflare D1.
   */
  public static async getAllNodes(db: D1Database): Promise<PlanetarySwarmNode[]> {
    return getAllPlanetarySwarmNodes(db);
  }

  /**
   * Records a settled spot compute auction into Cloudflare D1.
   */
  public static async recordAuction(db: D1Database, auction: AgenticSpotAuction): Promise<void> {
    return recordPlanetarySpotAuction(db, auction);
  }
}
