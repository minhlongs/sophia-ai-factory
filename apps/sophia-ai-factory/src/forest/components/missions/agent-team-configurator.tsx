'use client';

/**
 * AgentTeamConfigurator — Thin facade re-exporting TeamConfiguratorView.
 * Decomposed per Cluster 2 architectural refactor (< 25 LOC).
 */
import { TeamConfiguratorView } from './team-config';

export function AgentTeamConfigurator() {
  return <TeamConfiguratorView />;
}

export default AgentTeamConfigurator;
