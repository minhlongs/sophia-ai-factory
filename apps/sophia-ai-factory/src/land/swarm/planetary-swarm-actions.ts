/**
 * planetary-swarm-actions.ts — Gate 11 Planetary Swarm 3.0 & ZK-DID Server Actions
 * Layer: LAND (Server Actions / Controllers)
 *
 * Provides authenticated server actions for managing trans-continental swarm nodes,
 * issuing and verifying ZK-DID credentials, and executing agentic spot auctions.
 */

'use server';

import { getD1 } from '@/seed/db/client';
import {
  type PlanetarySwarmNode,
  type ZkDidIdentity,
  type SpotBidRequest,
  type SpotAuctionMatchResult,
} from '@/seed/types/planetary-swarm';
import {
  PlanetarySwarmV3Coordinator,
  type PartitionHealthReport,
} from '@/tree/swarm/planetary-swarm-v3-coordinator';
import {
  ZkDidVerifier,
  type DidIssuanceInput,
  type DidVerificationResult,
} from '@/tree/identity/zk-did-verifier';
import {
  loadSwarmNodesFromD1,
  runAuthenticatedSwarmAction,
  type SwarmActionResponse,
} from './planetary-swarm-action-helpers';

export type { SwarmActionResponse };

/**
 * Registers or updates a planetary swarm node.
 */
export async function registerPlanetaryNodeAction(
  node: PlanetarySwarmNode,
): Promise<SwarmActionResponse<PlanetarySwarmNode>> {
  return runAuthenticatedSwarmAction(
    'registerPlanetaryNodeAction',
    'Failed to register swarm node',
    async () => {
      const db = await getD1();
      if (db) {
        await PlanetarySwarmV3Coordinator.persistNode(db, node);
      }
      return node;
    },
  );
}

/**
 * Issues a new W3C compliant ZK-DID identity.
 */
export async function issueZkDidIdentityAction(
  input: DidIssuanceInput,
): Promise<SwarmActionResponse<ZkDidIdentity>> {
  return runAuthenticatedSwarmAction(
    'issueZkDidIdentityAction',
    'Failed to issue ZK-DID',
    async () => {
      const identity = ZkDidVerifier.issueIdentity(input);
      const db = await getD1();
      if (db) {
        await ZkDidVerifier.registerIdentityInDb(db, identity);
      }
      return identity;
    },
  );
}

/**
 * Verifies a ZK-DID identity's cryptographic validity and status.
 */
export async function verifyZkDidIdentityAction(
  identity: ZkDidIdentity,
): Promise<SwarmActionResponse<DidVerificationResult>> {
  return runAuthenticatedSwarmAction(
    'verifyZkDidIdentityAction',
    'Failed to verify ZK-DID',
    async () => ZkDidVerifier.verifyIdentity(identity),
  );
}

/**
 * Matches and clears an agentic spot compute auction order.
 */
export async function matchSpotAuctionAction(
  bid: SpotBidRequest,
): Promise<SwarmActionResponse<SpotAuctionMatchResult>> {
  return runAuthenticatedSwarmAction(
    'matchSpotAuctionAction',
    'Failed to match spot auction',
    async () => {
      const nodes = await loadSwarmNodesFromD1();
      return PlanetarySwarmV3Coordinator.matchSpotComputeAuction(nodes, bid);
    },
  );
}

/**
 * Evaluates the trans-continental mesh health and Byzantine quorum status.
 */
export async function getPlanetaryMeshHealthAction(): Promise<
  SwarmActionResponse<PartitionHealthReport>
> {
  return runAuthenticatedSwarmAction(
    'getPlanetaryMeshHealthAction',
    'Failed to evaluate mesh health',
    async () => {
      const nodes = await loadSwarmNodesFromD1();
      return PlanetarySwarmV3Coordinator.evaluateByzantineQuorum(nodes);
    },
  );
}
