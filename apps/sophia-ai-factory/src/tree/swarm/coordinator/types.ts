/**
 * Autonomous Swarm Coordinator Types & Constants
 *
 * @module tree/swarm/coordinator/types
 */

export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 60_000; // 60 seconds

export interface NodeCandidateFilter {
  role?: import('@/seed/types/autonomous-swarm').SwarmNodeRole;
  status?: import('@/seed/types/autonomous-swarm').SwarmNodeStatus;
  region?: import('@/seed/types/autonomous-swarm').SwarmRegion;
}
