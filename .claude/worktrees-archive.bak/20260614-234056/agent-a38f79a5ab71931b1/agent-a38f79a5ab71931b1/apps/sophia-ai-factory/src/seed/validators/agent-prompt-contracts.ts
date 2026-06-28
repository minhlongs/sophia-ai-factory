/**
 * agent-prompt-contracts.ts — Zod schemas for typed prompt contracts per AgentRole.
 *
 * Layer: seed (foundational — no business logic, no side effects)
 * Phase 03: Typed Prompt Contracts
 *
 * Each AgentRole has a dedicated schema extending the common base.
 * validatePromptContract() is the single entry-point for fleet spawner validation.
 */

import { z } from 'zod';
import type { AgentRole } from '@/seed/types/multi-agent';

// ---------------------------------------------------------------------------
// Base schema — fields common to all roles
// ---------------------------------------------------------------------------

const promptContractBase = z.object({
  objective: z.string().min(1, 'objective is required').max(2000, 'objective must be at most 2000 characters'),
  outputFormat: z.enum(['json', 'markdown', 'text', 'structured']),
  maxTokens: z.number().int().positive().max(100_000).optional(),
  escalationRules: z.array(z.string()).max(10).optional(),
});

// ---------------------------------------------------------------------------
// Role-specific schemas
// ---------------------------------------------------------------------------

export const scriptWriterSchema = promptContractBase.extend({
  topic: z.string().min(1, 'topic is required').max(500),
  tone: z.enum(['professional', 'casual', 'educational', 'entertaining']),
  targetLength: z.enum(['short', 'medium', 'long']),
});

export const voiceGeneratorSchema = promptContractBase.extend({
  voiceId: z.string().min(1, 'voiceId is required'),
  language: z.string().min(2).max(10),
  scriptText: z.string().min(1, 'scriptText is required').max(50_000),
});

export const videoProducerSchema = promptContractBase.extend({
  audioUrl: z.string().url('audioUrl must be a valid URL'),
  visualStyle: z.string().min(1, 'visualStyle is required'),
  duration: z.number().positive().max(3600).optional(),
});

export const publisherSchema = promptContractBase.extend({
  platforms: z.array(z.string()).min(1, 'at least one platform is required').max(20),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const analystSchema = promptContractBase.extend({
  metrics: z.array(z.string()).min(1, 'at least one metric is required').max(50),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  compareWith: z.string().optional(),
});

export const supervisorSchema = promptContractBase.extend({
  pipeline: z
    .array(
      z.enum([
        'supervisor',
        'script_writer',
        'voice_generator',
        'video_producer',
        'publisher',
        'analyst',
      ]),
    )
    .min(1, 'pipeline must have at least one role'),
  config: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Role → schema lookup map
// ---------------------------------------------------------------------------

const ROLE_SCHEMAS: Record<AgentRole, z.ZodTypeAny> = {
  supervisor: supervisorSchema,
  script_writer: scriptWriterSchema,
  voice_generator: voiceGeneratorSchema,
  video_producer: videoProducerSchema,
  publisher: publisherSchema,
  analyst: analystSchema,
};

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * Thrown when a prompt contract fails Zod validation.
 * Carries the role and the full ZodIssue list for actionable error messages.
 */
export class PromptContractError extends Error {
  constructor(
    public readonly role: AgentRole,
    public readonly issues: z.ZodIssue[],
  ) {
    const summary = issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    super(`Prompt contract validation failed for role '${role}': ${summary}`);
    this.name = 'PromptContractError';
  }
}

// ---------------------------------------------------------------------------
// Validate function — single entry-point
// ---------------------------------------------------------------------------

/**
 * Validate a prompt contract against its role's Zod schema.
 *
 * @param role     The agent role — determines which schema to apply
 * @param contract Untyped input (typically from AgentTask.promptContract)
 * @returns        Parsed, type-safe contract data on success
 * @throws         PromptContractError with field-level details on failure
 */
export function validatePromptContract(
  role: AgentRole,
  contract: unknown,
): Record<string, unknown> {
  const schema = ROLE_SCHEMAS[role];
  const result = schema.safeParse(contract);
  if (!result.success) {
    throw new PromptContractError(role, result.error.issues);
  }
  return result.data as Record<string, unknown>;
}
