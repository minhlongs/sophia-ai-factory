'use client';

/**
 * SopFieldInput — single JSON-Schema field input renderer for SopConfigForm.
 *
 * Layer: forest/components/sop
 * @module forest/components/sop/sop-field-input
 */

export interface SchemaProperty {
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

export interface JsonSchema {
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

export interface FieldInputProps {
  fieldKey: string;
  prop: SchemaProperty;
  value: unknown;
  required: boolean;
  onChange: (v: unknown) => void;
}

export function FieldInput({
  prop,
  value,
  required,
  onChange,
}: FieldInputProps) {
  const baseClass =
    'w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary';
  const strVal = value != null ? String(value) : '';

  if (prop.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-primary"
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
          <option key={opt} value={opt}>
            {opt}
          </option>
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
        onChange={(e) =>
          onChange(
            prop.type === 'integer' ? parseInt(e.target.value, 10) : parseFloat(e.target.value),
          )
        }
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
