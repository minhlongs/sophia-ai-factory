/**
 * @module seed/types/creative-intelligence
 *
 * Creative intelligence contracts for Hermes.
 *
 * Stable schemas for `creative.reason` and `creative.prompt.optimize`.
 * Uses existing Sophia types + Zod + Result pattern.
 *
 * Invalid model output returns typed Result failure — never crashes.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import { z } from 'zod';
import { success, failure, type Result } from './result';

// ── Creative Reasoning ────────────────────────────────────────────────────────

/** Request to generate creative reasoning for a brief. */
export interface CreativeReasoningRequest {
  brief: string;
  context?: string;
  model?: string;
  constraints?: string[];
}

/** Zod schema for CreativeReasoningRequest. */
export const CreativeReasoningRequestSchema = z.object({
  brief: z.string().min(1, 'brief is required'),
  context: z.string().optional(),
  model: z.string().optional(),
  constraints: z.array(z.string()).optional(),
});

/** Response containing structured creative reasoning. */
export interface CreativeReasoningResponse {
  concept: string;
  rationale: string;
  audienceFit: string;
  riskFactors: string[];
  alternatives: string[];
}

/** Zod schema for CreativeReasoningResponse. */
export const CreativeReasoningResponseSchema = z.object({
  concept: z.string().min(1, 'concept is required'),
  rationale: z.string().min(1, 'rationale is required'),
  audienceFit: z.string().min(1, 'audienceFit is required'),
  riskFactors: z.array(z.string()),
  alternatives: z.array(z.string()),
});

// ── Prompt Optimization ───────────────────────────────────────────────────────

/** Request to optimize a prompt for a target platform. */
export interface PromptOptimizeRequest {
  originalPrompt: string;
  targetPlatform?: string;
  style?: string;
}

/** Zod schema for PromptOptimizeRequest. */
export const PromptOptimizeRequestSchema = z.object({
  originalPrompt: z.string().min(1, 'originalPrompt is required'),
  targetPlatform: z.string().optional(),
  style: z.string().optional(),
});

/** Response containing an optimized prompt. */
export interface PromptOptimizeResponse {
  optimizedPrompt: string;
  changes: string[];
  confidence: number;
}

/** Zod schema for PromptOptimizeResponse. */
export const PromptOptimizeResponseSchema = z.object({
  optimizedPrompt: z.string().min(1, 'optimizedPrompt is required'),
  changes: z.array(z.string()),
  confidence: z.number().min(0).max(1, 'confidence must be between 0 and 1'),
});

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Validate a raw model output against the CreativeReasoningResponse schema.
 *
 * @param raw — Raw JSON from the model (unknown shape).
 * @returns Result with validated response or descriptive error string.
 */
export function validateReasoningResponse(
  raw: unknown,
): Result<CreativeReasoningResponse, string> {
  const parsed = CreativeReasoningResponseSchema.safeParse(raw);
  if (parsed.success) {
    return success(parsed.data);
  }
  const message = parsed.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return failure(`Invalid creative reasoning response: ${message}`);
}

/**
 * Validate a raw model output against the PromptOptimizeResponse schema.
 *
 * @param raw — Raw JSON from the model (unknown shape).
 * @returns Result with validated response or descriptive error string.
 */
export function validateOptimizeResponse(
  raw: unknown,
): Result<PromptOptimizeResponse, string> {
  const parsed = PromptOptimizeResponseSchema.safeParse(raw);
  if (parsed.success) {
    return success(parsed.data);
  }
  const message = parsed.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return failure(`Invalid prompt optimization response: ${message}`);
}