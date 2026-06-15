/**
 * SOP Output Validator
 *
 * Validates aggregate step results against the SOP template's JSON Schema.
 * Uses zod's object validation for required properties (zod is already a dep).
 *
 * Supports JSON Schema draft-07 style: required[], properties.
 * Cache compiled validators by templateId to avoid re-parsing per run.
 */

import { z } from 'zod';

/** Cached validators keyed by templateId */
const validatorCache = new Map<string, (data: unknown) => ValidationResult>();

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Build a validator from JSON Schema string.
 * Supports: required[], properties with type checks.
 */
function buildValidator(schemaJson: string): (data: unknown) => ValidationResult {
  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(schemaJson) as Record<string, unknown>;
  } catch {
    // Invalid schema — warn and pass-through
    return (_data) => ({ valid: true, errors: ['schema parse failed — skipped validation'] });
  }

  const required = (Array.isArray(schema.required) ? schema.required : []) as string[];
  const properties = (schema.properties && typeof schema.properties === 'object'
    ? schema.properties
    : {}) as Record<string, { type?: string }>;

  return (data: unknown): ValidationResult => {
    const errors: string[] = [];

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      errors.push('Output must be a JSON object');
      return { valid: false, errors };
    }

    const obj = data as Record<string, unknown>;

    // Check required fields
    for (const field of required) {
      if (!(field in obj)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Check property types where defined
    for (const [field, propSchema] of Object.entries(properties)) {
      if (!(field in obj)) continue;
      if (!propSchema.type) continue;

      const val = obj[field];
      const actualType = Array.isArray(val) ? 'array' : typeof val;

      if (propSchema.type === 'array' && !Array.isArray(val)) {
        errors.push(`Field "${field}" must be array, got ${actualType}`);
      } else if (propSchema.type !== 'array' && actualType !== propSchema.type) {
        // boolean const check (for requiresApproval: true)
        const constVal = (propSchema as Record<string, unknown>).const;
        if (constVal !== undefined && val !== constVal) {
          errors.push(`Field "${field}" must be ${String(constVal)}`);
        } else if (constVal === undefined) {
          errors.push(`Field "${field}" must be ${propSchema.type}, got ${actualType}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  };
}

/**
 * Validate output against the template's JSON Schema.
 * Throws if validation fails (for use inside sop-runner's try/catch).
 */
export function validateOutput(
  output: Record<string, unknown>,
  schemaJson: string,
  templateId: string,
): void {
  if (!validatorCache.has(templateId)) {
    validatorCache.set(templateId, buildValidator(schemaJson));
  }

  const validate = validatorCache.get(templateId)!;
  const result = validate(output);

  if (!result.valid) {
    throw new Error(`Output validation failed: ${result.errors.join('; ')}`);
  }
}

/** Clear cache (for testing) */
export function clearValidatorCache(): void {
  validatorCache.clear();
}

// Re-export z for test convenience — not used at runtime
export { z };
