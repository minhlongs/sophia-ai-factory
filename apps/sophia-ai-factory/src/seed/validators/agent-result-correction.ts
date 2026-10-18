/**
 * agent-result-correction.ts — Self-correction parser for malformed LLM JSON strings.
 *
 * Layer: seed (foundational — no business logic, no side effects)
 */

import type { z } from 'zod';
import {
  AgentResultValidationError,
  validateAgentResult,
  type ValidationOutcome,
} from './agent-result-contracts';

export function tryParseAndCorrect(rawString: string): ValidationOutcome {
  let parsed: unknown;

  // Attempt 1: direct parse
  try {
    parsed = JSON.parse(rawString);
    return validateAgentResult(parsed);
  } catch {
    // Continue to correction attempts
  }

  // Attempt 2: fix trailing commas
  try {
    const fixed = rawString.replace(/,\s*([}\]])/g, '$1');
    parsed = JSON.parse(fixed);
    return validateAgentResult(parsed);
  } catch {
    // Continue
  }

  // Attempt 3: extract JSON object from surrounding text
  try {
    const jsonMatch = rawString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extracted = jsonMatch[0].replace(/,\s*([}\]])/g, '$1');
      parsed = JSON.parse(extracted);
      return validateAgentResult(parsed);
    }
  } catch {
    // Continue
  }

  // Attempt 4: handle truncated JSON by closing braces
  try {
    let balanced = rawString.trim();
    const opens = (balanced.match(/\{/g) ?? []).length;
    const closes = (balanced.match(/\}/g) ?? []).length;
    if (opens > closes) {
      balanced += '}'.repeat(opens - closes);
      const fixed = balanced.replace(/,\s*([}\]])/g, '$1');
      parsed = JSON.parse(fixed);
      return validateAgentResult(parsed);
    }
  } catch {
    // All attempts failed
  }

  const issues: z.ZodIssue[] = [{
    code: 'custom',
    path: [],
    message: 'Could not parse input as valid JSON after correction attempts',
  }];
  return {
    valid: false,
    error: new AgentResultValidationError(issues, rawString),
    correctionHint: 'Your output is not valid JSON. Please return a JSON object with: { "success": boolean, "data": ... } or { "success": false, "error": { "code": "...", "message": "...", "retryable": boolean } }',
  };
}
