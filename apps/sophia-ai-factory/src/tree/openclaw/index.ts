/**
 * OpenClaw layer — tree wrapper for cross-layer access.
 *
 * Tree code imports from '@/tree/openclaw' instead of '@/land/openclaw'.
 * Re-exports from land/openclaw (canonical implementation).
 */
export { routeLLM } from '@/land/openclaw/llm-router';
export { spawnAgentFleet } from '@/forest/openclaw/spawn-agent-fleet';
export type { AgentTask } from '@/forest/openclaw/spawn-agent-fleet';
