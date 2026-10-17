'use client';

/**
 * SopConfigForm — renders a no-code form from JSON Schema.
 *
 * Supports field types: string, integer, number, boolean, string+enum.
 * Controlled — calls onChange with current values object.
 * Zero external form library dependency.
 */

import {
  FieldInput,
  type JsonSchema,
  type SchemaProperty,
  type FieldInputProps,
} from './sop-field-input';

export { FieldInput, type JsonSchema, type SchemaProperty, type FieldInputProps };

interface SopConfigFormProps {
  schema: JsonSchema;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

function parseSchema(raw: string | null | undefined): JsonSchema | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JsonSchema;
  } catch {
    return null;
  }
}

/**
 * Renders a no-code form from a JSON Schema string.
 * Returns null if schema is empty or invalid.
 */
export function SopConfigForm({ schema, values, onChange }: SopConfigFormProps) {
  if (!schema.properties) return null;
  const required = new Set(schema.required ?? []);

  function handleFieldChange(key: string, val: unknown) {
    onChange({ ...values, [key]: val });
  }

  const entries = Object.entries(schema.properties);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-4">
      {entries.map(([key, prop]) => (
        <div key={key}>
          {prop.title && (
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {prop.title}
              {required.has(key) && <span className="text-red-400 ml-1">*</span>}
            </label>
          )}
          <FieldInput
            fieldKey={key}
            prop={prop}
            value={values[key] ?? prop.default ?? ''}
            required={required.has(key)}
            onChange={(v) => handleFieldChange(key, v)}
          />
          {prop.description && prop.type !== 'boolean' && (
            <p className="text-xs text-muted-foreground mt-1">{prop.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/** Parse config schema + defaults from template fields */
export function parseConfigSchema(
  configSchemaStr: string | null | undefined,
  configDefaultsStr: string | null | undefined,
): { schema: JsonSchema | null; defaults: Record<string, unknown> } {
  const schema = parseSchema(configSchemaStr);
  let defaults: Record<string, unknown> = {};
  try {
    if (configDefaultsStr) defaults = JSON.parse(configDefaultsStr) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return { schema, defaults };
}
