/**
 * planetary-swarm.ts — Gate 11 Milestone Seed Types
 * Pillar 2: Planetary Autonomous Swarm 3.0, W3C ZK-DID Identity Mesh & Agentic Spot Compute Auctions
 *
 * Target: Trans-Continental Byzantine-Resilient Mesh with Sub-10ms Heartbeats
 */

export const SWARM_V3_CONSTANTS = {
  SUB_10MS_PLANETARY_HEARTBEAT: 10, // 10ms
  MAX_ALLOWED_PARTITION_HEAL_MS: 3_000, // 3 seconds
  BYZANTINE_QUORUM_RATIO: 2 / 3, // > 66.67%
  AUCTION_MAX_DISPATCH_SECONDS: 3600, // 1 hour max spot duration
  DEFAULT_DID_METHOD: 'did:sophia:zk',
} as const;

export type SwarmContinent = 'NORTH_AMERICA' | 'EUROPE' | 'ASIA_PACIFIC' | 'LATIN_AMERICA' | 'MIDDLE_EAST_AFRICA';
export type SwarmNodeStatus = 'ONLINE' | 'SYNCING' | 'DEGRADED' | 'PARTITIONED' | 'OFFLINE';
export type SwarmConsensusRole = 'VALIDATOR' | 'OBSERVER' | 'ARBITRATOR';
export type DidRevocationStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type SpotAuctionResourceType = 'GPU_H100_HR' | 'GPU_A100_HR' | 'QUANTUM_PROOF_VERIFY' | 'HIGH_BANDWIDTH_EGRESS';
export type SpotAuctionStatus = 'BID_OPEN' | 'MATCHED' | 'SETTLED' | 'DISPUTED' | 'CANCELLED';

export interface PlanetarySwarmNode {
  id: string;
  nodeKey: string;
  continent: SwarmContinent;
  datacenterCode: string;
  ipAddressHash: string;
  ed25519PublicKey: string;
  status: SwarmNodeStatus;
  consensusRole: SwarmConsensusRole;
  heartbeatLatencyMs: number;
  uptimePercentage: number;
  lastHeartbeatAt: string;
  registeredAt: string;
}

export interface ZkDidIdentity {
  id: string;
  did: string;
  ownerNodeId: string;
  controllerUri: string;
  publicKeyMultibase: string;
  credentialSchemaHash: string;
  revocationStatus: DidRevocationStatus;
  proofType: string;
  merkleProofHex: string;
  issuedAt: string;
  expiresAt: string;
}

export interface AgenticSpotAuction {
  id: string;
  auctionBatchId: string;
  sellerNodeId: string;
  buyerAgentDid: string;
  resourceType: SpotAuctionResourceType;
  unitsAllocated: number;
  clearingPriceMicros: number;
  settlementCurrency: string;
  durationSeconds: number;
  bidProofHash: string;
  settlementStatus: SpotAuctionStatus;
  executedAt: string;
}

export interface SpotBidRequest {
  buyerAgentDid: string;
  resourceType: SpotAuctionResourceType;
  maxPriceMicros: number;
  unitsRequested: number;
  durationSeconds: number;
  signatureEd25519: string;
}

export interface SpotAuctionMatchResult {
  auctionId: string;
  sellerNodeId: string;
  clearingPriceMicros: number;
  unitsAllocated: number;
  totalCostUsdCents: number;
  status: SpotAuctionStatus;
  bidProofHash: string;
}

export function rowToPlanetarySwarmNode(row: Record<string, unknown>): PlanetarySwarmNode {
  return {
    id: String(row.id),
    nodeKey: String(row.node_key),
    continent: String(row.continent) as SwarmContinent,
    datacenterCode: String(row.datacenter_code),
    ipAddressHash: String(row.ip_address_hash),
    ed25519PublicKey: String(row.ed25519_public_key),
    status: String(row.status) as SwarmNodeStatus,
    consensusRole: String(row.consensus_role) as SwarmConsensusRole,
    heartbeatLatencyMs: Number(row.heartbeat_latency_ms),
    uptimePercentage: Number(row.uptime_percentage),
    lastHeartbeatAt: String(row.last_heartbeat_at),
    registeredAt: String(row.registered_at),
  };
}

export function rowToZkDidIdentity(row: Record<string, unknown>): ZkDidIdentity {
  return {
    id: String(row.id),
    did: String(row.did),
    ownerNodeId: String(row.owner_node_id),
    controllerUri: String(row.controller_uri),
    publicKeyMultibase: String(row.public_key_multibase),
    credentialSchemaHash: String(row.credential_schema_hash),
    revocationStatus: String(row.revocation_status) as DidRevocationStatus,
    proofType: String(row.proof_type),
    merkleProofHex: String(row.merkle_proof_hex),
    issuedAt: String(row.issued_at),
    expiresAt: String(row.expires_at),
  };
}
