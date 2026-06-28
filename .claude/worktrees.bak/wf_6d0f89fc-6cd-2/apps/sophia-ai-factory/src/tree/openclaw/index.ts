/**
 * OpenClaw layer — tree wrapper for cross-layer access.
 *
 * Tree code imports from '@/tree/openclaw' instead of '@/land/openclaw'.
 * Re-exports from tree/agent-fleet (canonical implementation).
 */
export { routeLLM } from '@/tree/agent-fleet/llm-router';
export { spawnAgentFleet } from '@/tree/agent-fleet/spawn-agent-fleet';
export type { AgentTask } from '@/tree/agent-fleet/spawn-agent-fleet';
