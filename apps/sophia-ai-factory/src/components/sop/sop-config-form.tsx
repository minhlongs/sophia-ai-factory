'use client';

/**
 * SopConfigForm — renders a no-code form from JSON Schema.
 *
 * Supports field types: string, integer, number, boolean, string+enum.
 * Controlled — calls onChange with current values object.
 * Zero external form library dependency.
 */

interface SchemaProperty {
  type?: string;
  title?: string;
  description?: string;
  placeholder?: string;
  enum?: string[];
  default?: string | number | boolean;
  minimum?: number;
  maximum?: number;
  format?: string;
}

interface JsonSchema {
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

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

function FieldInput({
  fieldKey,
  prop,
  value,
  required,
  onChange,
}: {
  fieldKey: string;
  prop: SchemaProperty;
  value: unknown;
  required: boolean;
  onChange: (v: unknown) => void;
}) {
  const baseClass = 'w-full px-3 py-2 text-sm bg-zinc-900 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500';
  const strVal = value != null ? String(value) : '';

  if (prop.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-violet-600"
        />
        <span className="text-sm text-muted-foreground">{prop.description ?? ''}</span>
      </label>
    );
  }

  if (prop.enum && prop.enum.length > 0) {
    return (
      <select
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        className={baseClass}
        required={required}
      >
        {prop.enum.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (prop.type === 'integer' || prop.type === 'number') {
    return (
      <input
        type="number"
        value={strVal}
        min={prop.minimum}
        max={prop.maximum}
        onChange={(e) => onChange(prop.type === 'integer' ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
        className={baseClass}
        required={required}
      />
    );
  }

  if (prop.format === 'email') {
    return (
      <input
        type="email"
        value={strVal}
        placeholder={prop.placeholder ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={baseClass}
        required={required}
      />
    );
  }

  return (
    <input
      type="text"
      value={strVal}
      placeholder={prop.placeholder ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={baseClass}
      required={required}
    />
  );
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
  } catch { /* ignore */ }
  return { schema, defaults };
}
