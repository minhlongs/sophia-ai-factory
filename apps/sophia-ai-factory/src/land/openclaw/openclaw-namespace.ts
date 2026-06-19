/**
 * OpenClaw Orchestrator — Namespace facade
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
import { spawnAgentFleet, OpenclawTenantMissingError } from '@/tree/agent-fleet/spawn-agent-fleet';
import { withTenantScope, runAsTenant } from './with-tenant';
import { onEvent, emit } from './event-bus';
import { activateSkill } from './skill-loader';
import { scheduleAgent } from './schedule';
import { memory } from './memory-adapter';
import { mcp } from './mcp-gateway';
import { enqueue } from './queue';
import { audit } from '@/tree/agent-fleet/audit';
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
