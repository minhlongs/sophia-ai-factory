/**
 * Tests for short-code-generator
 */

import { describe, it, expect } from 'vitest';
import { generateShortCode, isValidShortCode } from './short-code-generator';

describe('generateShortCode', () => {
  it('returns a 13-character string', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(13);
  });

  it('only contains valid base32 characters [a-z2-7]', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateShortCode();
      expect(code).toMatch(/^[a-z2-7]{13}$/);
    }
  });

  it('generates unique codes on repeated calls', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateShortCode()));
    // With 64 bits of entropy, all 100 should be unique
    expect(codes.size).toBe(100);
  });
});

describe('isValidShortCode', () => {
  it('accepts valid 13-char base32 code', () => {
    expect(isValidShortCode('abcdefghijk23')).toBe(true);
  });

  it('accepts 8-char minimum code', () => {
    expect(isValidShortCode('abcd2347')).toBe(true);
  });

  it('rejects code shorter than 8 chars', () => {
    expect(isValidShortCode('abc')).toBe(false);
    expect(isValidShortCode('')).toBe(false);
  });

  it('rejects code longer than 13 chars', () => {
    expect(isValidShortCode('abcdefghijk234')).toBe(false);
  });

  it('rejects uppercase characters', () => {
    expect(isValidShortCode('ABCDEFGHIJK23')).toBe(false);
  });

  it('rejects invalid characters', () => {
    expect(isValidShortCode('abcdefgh890!')).toBe(false);
    expect(isValidShortCode('abcdefghijk-3')).toBe(false);
  });

  it('rejects characters 0,1,8,9 (not in base32 alphabet)', () => {
    expect(isValidShortCode('abcdefgh0123')).toBe(false);
    expect(isValidShortCode('abcdefgh1234')).toBe(false);
  });

  it('validates generated codes', () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidShortCode(generateShortCode())).toBe(true);
    }
  });
});
