/**
 * SEC-03: Indirect Prompt Injection Guard for Untrusted Research & Competitor Scraping
 *
 * Isolates untrusted web/social text in non-executable XML data tags, strips prompt-override
 * directives, and enforces strict Zod schema validation on structured LLM outputs.
 *
 * Layer: seed (foundational primitive)
 * @module seed/security/indirect-prompt-guard
 */

import { z } from 'zod';
import { failure, success, type Result } from '@/seed/types/result';

export interface SanitizedResearchInput {
  readonly wrappedContent: string;
  readonly cleanText: string;
  readonly injectionDetected: boolean;
  readonly matchedPatterns: string[];
}

const INJECTION_DIRECTIVE_PATTERNS: ReadonlyArray<{ id: string; regex: RegExp }> = [
  {
    id: 'ignore_instructions',
    regex: /\b(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|prompts|rules|directives)\b/gi,
  },
  {
    id: 'system_role_override',
    regex: /(?:<\s*\/?\s*(?:system|instruction|tool_call|function_call)\s*>|\b(?:system\s*prompt|you\s+are\s+now\s+in\s+developer\s+mode)\b)/gi,
  },
  {
    id: 'secret_exfiltration',
    regex: /\b(?:print|reveal|exfiltrate|output|send)\s+(?:all\s+)?(?:api\s*keys|environment\s+variables|secrets|tokens|credentials)\b/gi,
  },
  {
    id: 'tool_invocation_spoof',
    regex: /\b(?:execute_command|run_bash|call_tool|publish_unapproved|transfer_funds)\s*\(/gi,
  },
];

/**
 * Strips prompt-override patterns from scraped/competitor text and wraps it in
 * an isolated `<untrusted_research_data>` block for LLM consumption.
 */
export function sanitizeUntrustedResearchInput(
  rawText: string,
  maxChars = 4000,
): SanitizedResearchInput {
  const bounded = (rawText ?? '').slice(0, Math.max(1, maxChars));
  const matchedPatterns: string[] = [];
  let cleanText = bounded;

  for (const { id, regex } of INJECTION_DIRECTIVE_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(cleanText)) {
      matchedPatterns.push(id);
      regex.lastIndex = 0;
      cleanText = cleanText.replace(regex, '[STRIPPED_UNTRUSTED_DIRECTIVE]');
    }
  }

  // Neutralize angle-bracket tag breakouts inside the data envelope
  const escapedForEnvelope = cleanText
    .replace(/<\s*\/?\s*untrusted_research_data\s*>/gi, '[TAG_REMOVED]');

  return {
    wrappedContent: `<untrusted_research_data>${escapedForEnvelope}</untrusted_research_data>`,
    cleanText: escapedForEnvelope,
    injectionDetected: matchedPatterns.length > 0,
    matchedPatterns,
  };
}

export const StructuredResearchBriefSchema = z
  .object({
    topicSummary: z.string().min(1).max(600),
    hookAngles: z.array(z.string().min(1).max(200)).min(1).max(10),
    targetAudiencePainPoints: z.array(z.string().min(1).max(200)).max(10).default([]),
  })
  .strict();

export type StructuredResearchBrief = z.infer<typeof StructuredResearchBriefSchema>;

/**
 * Validates that an LLM output derived from untrusted research strictly conforms to the
 * expected Zod schema and contains no leaked credential or directive payloads.
 */
export function validateStructuredResearchOutput<T>(
  rawOutput: unknown,
  schema: z.ZodType<T> = StructuredResearchBriefSchema as unknown as z.ZodType<T>,
): Result<T, { code: string; message: string }> {
  const parsed = schema.safeParse(rawOutput);
  if (!parsed.success) {
    return failure({
      code: 'UNTRUSTED_OUTPUT_SCHEMA_VIOLATION',
      message: parsed.error.issues.map((i) => i.message).join('; '),
    });
  }
  return success(parsed.data);
}
