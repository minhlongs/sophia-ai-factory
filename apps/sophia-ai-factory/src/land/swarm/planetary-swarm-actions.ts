/**
 * planetary-swarm-actions.ts — Gate 11 Planetary Swarm 3.0 & ZK-DID Server Actions
 * Layer: LAND (Server Actions / Controllers)
 *
 * Provides authenticated server actions for managing trans-continental swarm nodes,
 * issuing and verifying ZK-DID credentials, and executing agentic spot auctions.
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
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

export interface SwarmActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Registers or updates a planetary swarm node.
 */
export async function registerPlanetaryNodeAction(
  node: PlanetarySwarmNode
): Promise<SwarmActionResponse<PlanetarySwarmNode>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const db = await getD1();
    if (db) {
      await PlanetarySwarmV3Coordinator.persistNode(db, node);
    }

    return { success: true, data: node };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to register swarm node';
    logger.error('registerPlanetaryNodeAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Issues a new W3C compliant ZK-DID identity.
 */
export async function issueZkDidIdentityAction(
  input: DidIssuanceInput
): Promise<SwarmActionResponse<ZkDidIdentity>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const identity = ZkDidVerifier.issueIdentity(input);
    const db = await getD1();

    if (db) {
      await ZkDidVerifier.registerIdentityInDb(db, identity);
    }

    return { success: true, data: identity };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to issue ZK-DID';
    logger.error('issueZkDidIdentityAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Verifies a ZK-DID identity's cryptographic validity and status.
 */
export async function verifyZkDidIdentityAction(
  identity: ZkDidIdentity
): Promise<SwarmActionResponse<DidVerificationResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const result = ZkDidVerifier.verifyIdentity(identity);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to verify ZK-DID';
    logger.error('verifyZkDidIdentityAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Matches and clears an agentic spot compute auction order.
 */
export async function matchSpotAuctionAction(
  bid: SpotBidRequest
): Promise<SwarmActionResponse<SpotAuctionMatchResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const db = await getD1();
    const nodes = db ? await PlanetarySwarmV3Coordinator.getAllNodes(db) : [];
    const result = PlanetarySwarmV3Coordinator.matchSpotComputeAuction(nodes, bid);

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to match spot auction';
    logger.error('matchSpotAuctionAction failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Evaluates the trans-continental mesh health and Byzantine quorum status.
 */
export async function getPlanetaryMeshHealthAction(): Promise<SwarmActionResponse<PartitionHealthReport>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required' };
    }

    const db = await getD1();
    const nodes = db ? await PlanetarySwarmV3Coordinator.getAllNodes(db) : [];
    const report = PlanetarySwarmV3Coordinator.evaluateByzantineQuorum(nodes);

    return { success: true, data: report };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to evaluate mesh health';
    logger.error('getPlanetaryMeshHealthAction failed', { error: message });
    return { success: false, error: message };
  }
}
