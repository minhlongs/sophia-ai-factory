/**
 * agent-result-contracts.ts — Zod schemas for structured agent OUTPUT validation.
 *
 * Layer: seed (foundational — no business logic, no side effects)
 *
 * Complements agent-prompt-contracts.ts (INPUT validation).
 * The validator pattern: schema validation → error feedback → self-correction
 * achieves ~80% fix on first retry for malformed LLM JSON output.
 */

import { z } from 'zod';
import { tryParseAndCorrect } from './agent-result-correction';

export { tryParseAndCorrect };

// ---------------------------------------------------------------------------
// Result envelope schema
// ---------------------------------------------------------------------------

const agentResultErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
});

const agentResultMetadataSchema = z.object({
  agentRole: z.string().optional(),
  executionTimeMs: z.number().nonnegative().optional(),
  modelUsed: z.string().optional(),
  tokensUsed: z.number().nonnegative().optional(),
});

export const agentResultSchema = z
  .object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: agentResultErrorSchema.optional(),
    metadata: agentResultMetadataSchema.optional(),
  })
  .refine(
    (d) => (d.success ? d.data !== undefined : d.error !== undefined),
    { message: 'success=true requires data; success=false requires error' },
  );

export type AgentResultEnvelope = z.infer<typeof agentResultSchema>;
export type AgentResultError = z.infer<typeof agentResultErrorSchema>;
export type AgentResultMetadata = z.infer<typeof agentResultMetadataSchema>;

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class AgentResultValidationError extends Error {
  constructor(
    public readonly issues: z.ZodIssue[],
    public readonly rawInput: unknown,
  ) {
    const summary = issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    super(`Agent result validation failed: ${summary}`);
    this.name = 'AgentResultValidationError';
  }
}

// ---------------------------------------------------------------------------
// Validate function
// ---------------------------------------------------------------------------

export interface ValidatedResult {
  valid: true;
  data: AgentResultEnvelope;
}

export interface InvalidResult {
  valid: false;
  error: AgentResultValidationError;
  correctionHint: string;
}

export type ValidationOutcome = ValidatedResult | InvalidResult;

export function validateAgentResult(raw: unknown): ValidationOutcome {
  const result = agentResultSchema.safeParse(raw);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  const err = new AgentResultValidationError(result.error.issues, raw);
  const hint = buildCorrectionHint(result.error.issues);
  return { valid: false, error: err, correctionHint: hint };
}

function buildCorrectionHint(issues: z.ZodIssue[]): string {
  const hints = issues.map((i) => {
    const path = i.path.join('.') || 'root';
    return `Fix "${path}": ${i.message}`;
  });
  return `Please fix the following issues in your JSON output:\n${hints.join('\n')}`;
}
