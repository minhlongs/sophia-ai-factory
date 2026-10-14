/**
 * D1 Persistence Helpers for Planetary Swarm v3 Nodes and Spot Auctions.
 * @module tree/swarm/planetary-swarm-v3-persistence
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type PlanetarySwarmNode,
  type AgenticSpotAuction,
  rowToPlanetarySwarmNode,
} from '@/seed/types/planetary-swarm';

/**
 * Persists a planetary swarm node into Cloudflare D1.
 */
export async function persistPlanetarySwarmNode(
  db: D1Database,
  node: PlanetarySwarmNode,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO planetary_swarm_nodes (
        id, node_key, continent, datacenter_code, ip_address_hash,
        ed25519_public_key, status, consensus_role, heartbeat_latency_ms,
        uptime_percentage, last_heartbeat_at, registered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      node.registeredAt,
    )
    .run();
}

/**
 * Fetches all registered planetary nodes from Cloudflare D1.
 */
export async function getAllPlanetarySwarmNodes(db: D1Database): Promise<PlanetarySwarmNode[]> {
  const { results } = await db
    .prepare('SELECT * FROM planetary_swarm_nodes')
    .all<Record<string, unknown>>();
  return results.map(rowToPlanetarySwarmNode);
}

/**
 * Records a settled spot compute auction into Cloudflare D1.
 */
export async function recordPlanetarySpotAuction(
  db: D1Database,
  auction: AgenticSpotAuction,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO agentic_spot_auctions (
        id, auction_batch_id, seller_node_id, buyer_agent_did,
        resource_type, units_allocated, clearing_price_micros,
        settlement_currency, duration_seconds, bid_proof_hash,
        settlement_status, executed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      auction.executedAt,
    )
    .run();
}
