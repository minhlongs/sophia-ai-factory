---
phase: 3
title: "Typed Prompt Contracts with Zod Validation"
status: completed
priority: P2
effort: 2h
---

# Phase 03: Typed Prompt Contracts

## Context Links

- Agent roles: `src/seed/types/multi-agent.ts:17-23` — 6 roles defined
- Fleet spawner: `src/lib/openclaw/spawn-agent-fleet.ts:21-30` — `AgentTask.prompt` is freeform `string`
- Existing Zod in seed: `src/seed/validators/proposal.ts`, `src/seed/db/audit/audit-log.ts`, `src/seed/config/one-time-skus.ts`

## Overview

Replace freeform `prompt: string` dispatch with typed prompt contracts per `AgentRole`. Each role gets a Zod schema defining its expected input (objective, output format, tool scope, escalation rules). Fleet spawner validates before dispatch.

## Key Insight

Research shows structured prompt contracts give 15-25% performance lift and reduce misclassification from 22% to 4%. Currently, `spawn-agent-fleet.ts` dispatches tasks with `prompt: string` — no structure, no validation. A malformed prompt silently produces garbage output. Zod validation catches this at dispatch time with actionable errors.

## Data Flow

```
caller builds AgentTask with role + promptContract
  ↓
spawnAgentFleet() → validatePromptContract(task)
  ↓                   ├→ lookup schema by task.role (or task.context.agentRole)
  ↓                   ├→ Zod parse prompt contract fields
  ↓                   └→ throw PromptContractError if invalid
  ↓
task dispatched to localExecutor with validated contract
  ↓
executor receives typed, validated input — no ambiguity
```

## Requirements

### Functional
- One Zod schema per `AgentRole` (6 roles)
- Common base fields: `objective` (string), `outputFormat` (enum), `maxTokens` (number)
- Role-specific fields: e.g. `voice_generator` needs `voiceId`, `language`
- Validation runs in fleet spawner before dispatch
- Invalid prompts throw `PromptContractError` with field-level details

### Non-Functional
- Validation adds < 1ms per task (Zod is fast for simple schemas)
- Schemas are tree-shakeable — only imported schemas are bundled
- Opt-in: existing callers using plain `prompt: string` still work (validation only fires when `promptContract` field is present)

## Architecture

```
seed/types/multi-agent.ts           ← add PromptContract type
seed/validators/agent-prompt-contracts.ts  ← Zod schemas per role
lib/openclaw/spawn-agent-fleet.ts   ← validate before dispatch
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/seed/validators/agent-prompt-contracts.ts` | Zod schemas for all 6 AgentRole prompt contracts |
| `src/seed/validators/__tests__/agent-prompt-contracts.test.ts` | Schema validation tests |

## Files to Modify

| File | Change |
|------|--------|
| `src/seed/types/multi-agent.ts` | Add `PromptContract` base type + role-specific contract types |
| `src/lib/openclaw/spawn-agent-fleet.ts` | Add optional `promptContract` to `AgentTask`; validate before dispatch |
| `src/lib/openclaw/__tests__/spawn-agent-fleet.test.ts` | Add prompt contract validation tests |

## Implementation Steps

### Step 1: Define Contract Types

In `src/seed/types/multi-agent.ts`, add:

```typescript
/** Base fields common to all agent prompt contracts */
export interface PromptContractBase {
  objective: string
  outputFormat: 'json' | 'markdown' | 'text' | 'structured'
  maxTokens?: number
  escalationRules?: string[]
}

/** Role-specific contract extensions */
export interface ScriptWriterContract extends PromptContractBase {
  topic: string
  tone: 'professional' | 'casual' | 'educational' | 'entertaining'
  targetLength: 'short' | 'medium' | 'long'
}

export interface VoiceGeneratorContract extends PromptContractBase {
  voiceId: string
  language: string
  scriptText: string
}

export interface VideoProducerContract extends PromptContractBase {
  audioUrl: string
  visualStyle: string
  duration?: number
}

export interface PublisherContract extends PromptContractBase {
  platforms: string[]
  scheduledAt?: string
  metadata?: Record<string, unknown>
}

export interface AnalystContract extends PromptContractBase {
  metrics: string[]
  timeRange: { start: string; end: string }
  compareWith?: string
}

export interface SupervisorContract extends PromptContractBase {
  pipeline: AgentRole[]
  config?: Record<string, unknown>
}

/** Union of all typed contracts */
export type PromptContract =
  | ScriptWriterContract
  | VoiceGeneratorContract
  | VideoProducerContract
  | PublisherContract
  | AnalystContract
  | SupervisorContract
```

### Step 2: Create Zod Schemas

Create `src/seed/validators/agent-prompt-contracts.ts`:

```typescript
import { z } from 'zod'
import type { AgentRole } from '@/seed/types/multi-agent'

const promptContractBase = z.object({
  objective: z.string().min(1).max(2000),
  outputFormat: z.enum(['json', 'markdown', 'text', 'structured']),
  maxTokens: z.number().int().positive().max(100_000).optional(),
  escalationRules: z.array(z.string()).max(10).optional(),
})

export const scriptWriterSchema = promptContractBase.extend({
  topic: z.string().min(1).max(500),
  tone: z.enum(['professional', 'casual', 'educational', 'entertaining']),
  targetLength: z.enum(['short', 'medium', 'long']),
})

export const voiceGeneratorSchema = promptContractBase.extend({
  voiceId: z.string().min(1),
  language: z.string().min(2).max(10),
  scriptText: z.string().min(1).max(50_000),
})

export const videoProducerSchema = promptContractBase.extend({
  audioUrl: z.string().url(),
  visualStyle: z.string().min(1),
  duration: z.number().positive().max(3600).optional(),
})

export const publisherSchema = promptContractBase.extend({
  platforms: z.array(z.string()).min(1).max(20),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const analystSchema = promptContractBase.extend({
  metrics: z.array(z.string()).min(1).max(50),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  compareWith: z.string().optional(),
})

export const supervisorSchema = promptContractBase.extend({
  pipeline: z.array(z.enum([
    'supervisor', 'script_writer', 'voice_generator',
    'video_producer', 'publisher', 'analyst',
  ])).min(1),
  config: z.record(z.unknown()).optional(),
})

const ROLE_SCHEMAS: Record<AgentRole, z.ZodSchema> = {
  supervisor: supervisorSchema,
  script_writer: scriptWriterSchema,
  voice_generator: voiceGeneratorSchema,
  video_producer: videoProducerSchema,
  publisher: publisherSchema,
  analyst: analystSchema,
}

export class PromptContractError extends Error {
  constructor(
    public role: AgentRole,
    public issues: z.ZodIssue[],
  ) {
    const summary = issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    super(`Prompt contract validation failed for role '${role}': ${summary}`)
    this.name = 'PromptContractError'
  }
}

/**
 * Validate a prompt contract against its role's schema.
 * Returns the parsed (cleaned) contract on success.
 * Throws PromptContractError on failure.
 */
export function validatePromptContract(
  role: AgentRole,
  contract: unknown,
): Record<string, unknown> {
  const schema = ROLE_SCHEMAS[role]
  const result = schema.safeParse(contract)
  if (!result.success) {
    throw new PromptContractError(role, result.error.issues)
  }
  return result.data as Record<string, unknown>
}
```

### Step 3: Integrate into Fleet Spawner

Modify `src/lib/openclaw/spawn-agent-fleet.ts`:

1. Add `promptContract` field to `AgentTask`:

```typescript
export interface AgentTask {
  id: string
  prompt: string
  context?: Record<string, unknown>
  tier?: 'lite' | 'standard' | 'max'
  /** Typed prompt contract — validated before dispatch if present */
  promptContract?: Record<string, unknown>
  /** Agent role for contract validation */
  agentRole?: AgentRole
}
```

2. Add validation before dispatch in `runTask()`:

```typescript
import { validatePromptContract, PromptContractError } from '@/seed/validators/agent-prompt-contracts'
import type { AgentRole } from '@/seed/types/multi-agent'

// In runTask(), before localExecutor:
if (task.promptContract && task.agentRole) {
  validatePromptContract(task.agentRole, task.promptContract)
}
```

3. Catch `PromptContractError` specifically in the error handler:

```typescript
catch (err) {
  return {
    taskId: task.id,
    success: false,
    error: err instanceof PromptContractError
      ? `Contract validation: ${err.message}`
      : String(err),
    durationMs: Date.now() - start,
  }
}
```

### Step 4: Backwards Compatibility

- `promptContract` and `agentRole` are OPTIONAL on `AgentTask`
- Validation only fires when BOTH are present
- Existing callers using plain `prompt: string` are unaffected
- No migration needed — this is purely a code change

## Todo List

- [x] Add `PromptContract` types to `seed/types/multi-agent.ts`
- [x] Verify file stays under 200 lines (currently 82 lines + ~50 new = ~132, OK)
- [x] Create `seed/validators/agent-prompt-contracts.ts` with 6 Zod schemas
- [x] Create `seed/validators/__tests__/agent-prompt-contracts.test.ts`
- [x] Add `promptContract` + `agentRole` to `AgentTask` in fleet spawner
- [x] Add validation call in `runTask()`
- [x] Update fleet spawner tests: valid contract passes, invalid rejects
- [x] Verify build passes

## Test Matrix

| Test | Input | Expected |
|------|-------|----------|
| Valid script_writer contract | `{ objective: "...", outputFormat: "markdown", topic: "...", tone: "casual", targetLength: "short" }` | Passes, returns parsed contract |
| Missing required field | `{ objective: "..." }` (missing topic for script_writer) | Throws `PromptContractError` with path `topic` |
| Invalid enum value | `{ tone: "angry" }` | Throws with `tone: Invalid enum value` |
| No contract (backwards compat) | `{ id: "1", prompt: "do stuff" }` (no promptContract) | Passes without validation |
| Oversized objective | `{ objective: "x".repeat(3000) }` | Throws with `objective: String must contain at most 2000 character(s)` |
| Each role schema | One valid contract per role | All 6 pass |

## Success Criteria

- All 6 role schemas validate correct inputs
- Invalid inputs produce actionable error messages with field paths
- Fleet spawner dispatches validated contracts
- Fleet spawner still works without contracts (backwards compatible)
- Zero `:any` types in new code
- All tests pass

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Schema too restrictive, blocks valid use cases | Medium | Medium | Schemas are intentionally loose (optional fields, generous limits); iterate based on usage |
| Adding to multi-agent.ts pushes it over 200 lines | Low | Low | 82 + ~50 = ~132 lines; headroom exists. If needed, extract contract types to separate file |
| Zod bundle size increase | Low | Low | Zod already in project deps; schemas are small |

## Security

- Contract validation prevents injection via malformed prompt structures
- `maxTokens` cap at 100K prevents budget exhaustion per task
- `z.string().max()` limits prevent oversized payloads

## Next Steps

- Once contracts are live, add telemetry: track validation failure rate per role
- Consider generating prompt templates from contracts (contract -> actual LLM prompt string)
- Consider making contracts required (remove opt-in) after adoption period
