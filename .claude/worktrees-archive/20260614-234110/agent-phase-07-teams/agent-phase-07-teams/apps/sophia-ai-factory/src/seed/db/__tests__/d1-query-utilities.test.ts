/**
 * Tests for d1-query-utilities.ts
 *
 * Covers serializeValue (object → JSON, primitives passthrough) and
 * parseJsonFields (TEXT-stored JSON auto-decode) — both used along the
 * D1 upsert/select boundary where JSONB-style columns round-trip
 * through TEXT storage.
 */

import { describe, it, expect } from 'vitest';
import { serializeValue, parseJsonFields } from '@/seed/db/d1-query-utilities';

describe('serializeValue', () => {
  it('returns null for undefined', () => {
    expect(serializeValue(undefined)).toBeNull();
  });

  it('passes null through unchanged', () => {
    expect(serializeValue(null)).toBeNull();
  });

  it.each([
    ['string', 'hello'],
    ['number', 42],
    ['zero', 0],
    ['negative number', -1.5],
    ['true', true],
    ['false', false],
    ['empty string', ''],
  ])('passes %s primitive through unchanged', (_label, value) => {
    expect(serializeValue(value)).toBe(value);
  });

  it('passes Date through unchanged (consumer formats it)', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    expect(serializeValue(d)).toBe(d);
  });

  it('JSON-stringifies plain objects', () => {
    const obj = { foo: 'bar', n: 1 };
    expect(serializeValue(obj)).toBe('{"foo":"bar","n":1}');
  });

  it('JSON-stringifies arrays', () => {
    expect(serializeValue([1, 'a', null])).toBe('[1,"a",null]');
  });

  it('JSON-stringifies nested objects', () => {
    const nested = { a: { b: { c: [1, 2] } } };
    expect(serializeValue(nested)).toBe('{"a":{"b":{"c":[1,2]}}}');
  });

  it('JSON-stringifies empty object', () => {
    expect(serializeValue({})).toBe('{}');
  });

  it('JSON-stringifies empty array', () => {
    expect(serializeValue([])).toBe('[]');
  });
});

describe('parseJsonFields', () => {
  it('returns null unchanged', () => {
    expect(parseJsonFields(null)).toBeNull();
  });

  it('returns undefined unchanged', () => {
    expect(parseJsonFields(undefined)).toBeUndefined();
  });

  it('returns primitive unchanged when typeof !== object', () => {
    // The function checks `typeof row !== 'object'` — string falls through.
    expect(parseJsonFields('not-an-object' as unknown)).toBe('not-an-object');
  });

  it('parses TEXT field starting with `{` as JSON object', () => {
    const row = { id: '1', metadata: '{"key":"value"}' };
    const out = parseJsonFields(row);
    expect(out.metadata).toEqual({ key: 'value' });
  });

  it('parses TEXT field starting with `[` as JSON array', () => {
    const row = { id: '1', tags: '["a","b","c"]' };
    const out = parseJsonFields(row);
    expect(out.tags).toEqual(['a', 'b', 'c']);
  });

  it('keeps invalid JSON string unchanged (silent catch)', () => {
    const row = { id: '1', broken: '{not valid json}' };
    const out = parseJsonFields(row);
    expect(out.broken).toBe('{not valid json}');
  });

  it('passes non-JSON-looking strings through', () => {
    const row = { id: 'abc', name: 'plain text' };
    const out = parseJsonFields(row);
    expect(out.name).toBe('plain text');
  });

  it('passes already-parsed objects through (no double-parse)', () => {
    const nested = { already: 'parsed' };
    const row = { id: '1', metadata: nested };
    const out = parseJsonFields(row);
    expect(out.metadata).toBe(nested);
  });

  it('parses nested JSON object inside outer object correctly', () => {
    const row = {
      id: '1',
      settings: '{"theme":"dark","prefs":{"lang":"vi"}}',
    };
    const out = parseJsonFields(row);
    expect(out.settings).toEqual({ theme: 'dark', prefs: { lang: 'vi' } });
  });

  it('preserves primitives alongside parsed JSON fields', () => {
    const row = { id: 'r1', count: 5, active: true, meta: '{"x":1}' };
    const out = parseJsonFields(row);
    expect(out.id).toBe('r1');
    expect(out.count).toBe(5);
    expect(out.active).toBe(true);
    expect(out.meta).toEqual({ x: 1 });
  });

  it('handles empty JSON object string', () => {
    const row = { id: '1', m: '{}' };
    expect(parseJsonFields(row).m).toEqual({});
  });

  it('handles empty JSON array string', () => {
    const row = { id: '1', t: '[]' };
    expect(parseJsonFields(row).t).toEqual([]);
  });

  it('does not mutate the input row', () => {
    const row = { id: '1', metadata: '{"key":"value"}' };
    const snapshot = JSON.stringify(row);
    parseJsonFields(row);
    expect(JSON.stringify(row)).toBe(snapshot);
  });
});
