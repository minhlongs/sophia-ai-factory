/**
 * SOP Argument Resolver
 *
 * Resolves `{{step_N.output.field}}`, `{{trigger.body.field}}`, and
 * `{{config.field}}` template placeholders in step args.
 *
 * Simple regex-replace — no full template engine (KISS).
 */

import type { StepResult } from './types';

const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g;

/**
 * Resolve template placeholders in a single value.
 * Returns the value unchanged if no placeholders, or placeholder path not found.
 */
function resolveValue(
  value: unknown,
  stepResults: StepResult[],
  triggerPayload: Record<string, unknown> | undefined,
  configValues: Record<string, unknown> | undefined,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, stepResults, triggerPayload, configValues));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        resolveValue(item, stepResults, triggerPayload, configValues),
      ]),
    );
  }

  if (typeof value !== 'string') return value;

  const exact = /^\s*\{\{([^}]+)\}\}\s*$/.exec(value);
  if (exact) {
    const resolved = resolvePath(exact[1].trim(), stepResults, triggerPayload, configValues);
    if (resolved === undefined) return value;
    return resolved !== null && typeof resolved === 'object' ? resolved : String(resolved);
  }

  return value.replace(PLACEHOLDER_RE, (match, path: string) => {
    const resolved = resolvePath(path.trim(), stepResults, triggerPayload, configValues);
    return resolved !== undefined ? String(resolved) : match;
  });
}

/** Resolve a dot-path like "step_1.output.foo", "trigger.body.email", or "config.field" */
function resolvePath(
  path: string,
  stepResults: StepResult[],
  triggerPayload: Record<string, unknown> | undefined,
  configValues: Record<string, unknown> | undefined,
): unknown {
  const parts = path.split('.');

  // {{config.field}} — from installation config_values
  if (parts[0] === 'config') {
    return getNestedValue(configValues ?? {}, parts.slice(1));
  }

  if (parts[0] === 'trigger' && parts[1] === 'body') {
    return getNestedValue(triggerPayload ?? {}, parts.slice(2));
  }

  // step_N.output.field
  const stepMatch = /^step_(\d+)$/.exec(parts[0]);
  if (stepMatch) {
    const stepOrder = parseInt(stepMatch[1], 10);
    const result = stepResults.find(r => r.order === stepOrder);
    if (!result) return undefined;

    // Expect parts[1] === 'output'
    if (parts[1] !== 'output') return undefined;
    return getNestedValue(result.output, parts.slice(2));
  }

  return undefined;
}

/** Traverse an object by path segments */
function getNestedValue(obj: Record<string, unknown>, segments: string[]): unknown {
  let current: unknown = obj;
  for (const seg of segments) {
    if (!current || typeof current !== 'object') return undefined;
    // Array index: "topics[0]" → "topics", 0
    const arrayMatch = /^(\w+)\[(\d+)\]$/.exec(seg);
    if (arrayMatch) {
      const [, key, idx] = arrayMatch;
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) return undefined;
      current = arr[parseInt(idx, 10)];
    } else {
      current = (current as Record<string, unknown>)[seg];
    }
  }
  return current;
}

/**
 * Resolve all template placeholders in step args.
 * Returns new args object with placeholders substituted.
 *
 * Supports: {{step_N.output.field}}, {{trigger.body.field}}, {{config.field}}
 */
export function resolveArgs(
  args: Record<string, unknown>,
  stepResults: StepResult[],
  triggerPayload?: Record<string, unknown>,
  configValues?: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    resolved[key] = resolveValue(value, stepResults, triggerPayload, configValues);
  }
  return resolved;
}
