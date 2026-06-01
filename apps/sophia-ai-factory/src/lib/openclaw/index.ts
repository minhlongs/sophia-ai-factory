/**
 * OpenClaw Orchestrator — Public API barrel
 * Phase 12: 10 primitives for the Sophia AI Factory agent substrate
 *
 * Usage:
 *   import { openclaw } from '@/land/openclaw'
 *   await openclaw.spawnAgentFleet([...], { tenantId })
 *   await openclaw.audit({ tenantId, action: 'video.gen.started' })
 *
 * Naming: "OpenClaw" here is an internal Sophia codename for the Phase 12
 * agent fleet orchestrator. Not affiliated with the public project at
 * github.com/openclaw/openclaw (a personal AI assistant gateway).
 */

export { spawnAgentFleet, OpenclawTenantMissingError } from './spawn-agent-fleet';
export type { AgentTask, AgentResult, SpawnFleetOptions } from './spawn-agent-fleet';

export { withTenantScope, runAsTenant, filterByTenant } from './with-tenant';
export type { TenantContext } from './with-tenant';

export { onEvent, emit, persistHook, loadHooks } from './event-bus';
export type { EventHandler } from './event-bus';

export { activateSkill } from './skill-loader';
export type { ActivatedSkill, SkillFrontmatter } from './skill-loader';

export { scheduleAgent } from './schedule';
export type { ScheduleOptions, ScheduledTaskResult } from './schedule';

export { memory } from './memory-adapter';
export type { MemoryAdapter, MemoryType } from './memory-adapter';

export { mcp, MCPDeniedError, MCPCallError, MCP_WHITELIST } from './mcp-gateway';
export type { MCPCallOptions } from './mcp-gateway';

export { enqueue } from './queue';
export type { EnqueueOptions, EnqueueResult } from './queue';

export { audit, queryAuditLog } from './audit';
export type { AuditEntry, AuditRow } from './audit';

export { rateLimitGate } from './rate-limit';
export type { RateLimitResult } from './rate-limit';

export { routeLLM } from './llm-router';
export type { LLMTier, LLMRouteOptions, LLMRouteResult } from './llm-router';

// ── Namespaced facade ──────────────────────────────────────────────────────

import { spawnAgentFleet } from './spawn-agent-fleet';
import { withTenantScope, runAsTenant } from './with-tenant';
import { onEvent, emit } from './event-bus';
import { activateSkill } from './skill-loader';
import { scheduleAgent } from './schedule';
import { memory } from './memory-adapter';
import { mcp } from './mcp-gateway';
import { enqueue } from './queue';
import { audit } from './audit';
import { rateLimitGate } from './rate-limit';
import { routeLLM } from './llm-router';

export const openclaw = {
  spawnAgentFleet,
  withTenant: withTenantScope,
  runAsTenant,
  onEvent,
  emit,
  activateSkill,
  scheduleAgent,
  memory,
  mcp,
  enqueue,
  audit,
  rateLimitGate,
  routeLLM,
} as const;
