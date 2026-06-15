/**
 * SopConfigForm tests — verify no-code config form rendering from JSON Schema.
 *
 * Covers: text inputs, number inputs, boolean checkboxes, enum selects,
 * required markers, parseConfigSchema utility.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SopConfigForm, parseConfigSchema } from './sop-config-form';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCHEMA_TEXT = JSON.stringify({
  properties: {
    recipient_email: {
      type: 'string',
      title: 'Recipient Email',
      format: 'email',
      placeholder: 'owner@agency.com',
    },
    max_posts: {
      type: 'integer',
      title: 'Max Posts',
      minimum: 1,
      maximum: 20,
    },
    notify: {
      type: 'boolean',
      title: 'Enable Notifications',
      description: 'Send Telegram alerts',
    },
    tone: {
      type: 'string',
      title: 'Tone',
      enum: ['professional', 'casual', 'friendly'],
    },
  },
  required: ['recipient_email'],
});

const DEFAULTS_TEXT = JSON.stringify({
  max_posts: 3,
  notify: false,
  tone: 'professional',
});

// ---------------------------------------------------------------------------
// parseConfigSchema
// ---------------------------------------------------------------------------

describe('parseConfigSchema', () => {
  it('returns parsed schema and defaults', () => {
    const { schema, defaults } = parseConfigSchema(SCHEMA_TEXT, DEFAULTS_TEXT);
    expect(schema).toBeTruthy();
    expect(schema?.properties?.recipient_email.format).toBe('email');
    expect(defaults.max_posts).toBe(3);
    expect(defaults.notify).toBe(false);
  });

  it('returns null schema for null input', () => {
    const { schema, defaults } = parseConfigSchema(null, null);
    expect(schema).toBeNull();
    expect(defaults).toEqual({});
  });

  it('returns empty defaults for invalid JSON', () => {
    const { defaults } = parseConfigSchema(SCHEMA_TEXT, 'not-json');
    expect(defaults).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// SopConfigForm rendering
// ---------------------------------------------------------------------------

describe('SopConfigForm', () => {
  it('renders null when schema has no properties', () => {
    const { container } = render(
      <SopConfigForm schema={{}} values={{}} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a text/email input for email format field', () => {
    const { schema } = parseConfigSchema(SCHEMA_TEXT, null);
    const { getByPlaceholderText } = render(
      <SopConfigForm schema={schema!} values={{}} onChange={() => {}} />,
    );
    const input = getByPlaceholderText('owner@agency.com') as HTMLInputElement;
    expect(input.type).toBe('email');
  });

  it('renders number input for integer field', () => {
    const { schema } = parseConfigSchema(SCHEMA_TEXT, DEFAULTS_TEXT);
    const { getByDisplayValue } = render(
      <SopConfigForm
        schema={schema!}
        values={{ max_posts: 3, notify: false, tone: 'professional' }}
        onChange={() => {}}
      />,
    );
    const input = getByDisplayValue('3') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.min).toBe('1');
    expect(input.max).toBe('20');
  });

  it('renders checkbox for boolean field', () => {
    const { schema } = parseConfigSchema(SCHEMA_TEXT, null);
    const { getByRole } = render(
      <SopConfigForm
        schema={schema!}
        values={{ notify: true }}
        onChange={() => {}}
      />,
    );
    const cb = getByRole('checkbox') as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });

  it('renders select for enum field', () => {
    const { schema } = parseConfigSchema(SCHEMA_TEXT, DEFAULTS_TEXT);
    const { getByDisplayValue } = render(
      <SopConfigForm
        schema={schema!}
        values={{ tone: 'casual' }}
        onChange={() => {}}
      />,
    );
    const select = getByDisplayValue('casual') as unknown as HTMLSelectElement;
    expect(select.tagName.toLowerCase()).toBe('select');
    expect(select.options).toHaveLength(3);
  });

  it('shows required asterisk for required fields', () => {
    const { schema } = parseConfigSchema(SCHEMA_TEXT, null);
    const { getByText } = render(
      <SopConfigForm schema={schema!} values={{}} onChange={() => {}} />,
    );
    // Required label should contain asterisk
    const label = getByText((content) => content.includes('Recipient Email'));
    expect(label.textContent).toContain('*');
  });

  it('calls onChange with updated values when text input changes', () => {
    const onChange = vi.fn();
    const { schema } = parseConfigSchema(SCHEMA_TEXT, null);
    const { getByPlaceholderText } = render(
      <SopConfigForm schema={schema!} values={{}} onChange={onChange} />,
    );
    const input = getByPlaceholderText('owner@agency.com');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ recipient_email: 'test@example.com' }),
    );
  });

  it('calls onChange with boolean when checkbox changes', () => {
    const onChange = vi.fn();
    const { schema } = parseConfigSchema(SCHEMA_TEXT, null);
    const { getByRole } = render(
      <SopConfigForm
        schema={schema!}
        values={{ notify: false }}
        onChange={onChange}
      />,
    );
    const cb = getByRole('checkbox');
    fireEvent.click(cb);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ notify: true }),
    );
  });
});
