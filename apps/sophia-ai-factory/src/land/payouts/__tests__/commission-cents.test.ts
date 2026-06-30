/**
 * Unit tests for commission-cents
 * @module land/payouts/__tests__/commission-cents.test
 */

import { describe, it, expect } from 'vitest';
import { toCents, fromCents, sanitizeErrorText } from '../commission-cents';

describe('toCents', () => {
  it('converts whole dollars to cents', () => {
    expect(toCents(1)).toBe(100);
    expect(toCents(10)).toBe(1000);
    expect(toCents(100)).toBe(10000);
  });

  it('converts fractional dollars to cents', () => {
    expect(toCents(0.50)).toBe(50);
    expect(toCents(1.99)).toBe(199);
    expect(toCents(199.99)).toBe(19999);
  });

  it('rounds half-up correctly', () => {
    expect(toCents(0.005)).toBe(1);
    expect(toCents(0.004)).toBe(0);
  });

  it('handles zero', () => {
    expect(toCents(0)).toBe(0);
  });

  it('handles negative values', () => {
    expect(toCents(-1)).toBe(-100);
    expect(toCents(-0.50)).toBe(-50);
  });
});

describe('fromCents', () => {
  it('converts cents to dollars', () => {
    expect(fromCents(100)).toBe(1);
    expect(fromCents(1000)).toBe(10);
    expect(fromCents(19999)).toBe(199.99);
  });

  it('handles zero', () => {
    expect(fromCents(0)).toBe(0);
  });

  it('handles negative values', () => {
    expect(fromCents(-100)).toBe(-1);
  });

  it('preserves precision for small amounts', () => {
    expect(fromCents(1)).toBe(0.01);
    expect(fromCents(50)).toBe(0.50);
  });
});

describe('sanitizeErrorText', () => {
  it('redacts T-prefixed strings (TRC20 addresses)', () => {
    const result = sanitizeErrorText('Transfer to TXYZ1234567890abcdefghijklmnopqrstuvwxyz failed');
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('TXYZ1234567890abcdefghijklmnopqrstuvwxyz');
  });

  it('redacts 0x-prefixed addresses (ETH/ERC20)', () => {
    const result = sanitizeErrorText('Address 0x1234567890abcdef1234567890abcdef12345678 is invalid');
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('0x1234567890abcdef1234567890abcdef12345678');
  });

  it('redacts Bearer tokens', () => {
    const result = sanitizeErrorText('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0');
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('eyJhbGci');
  });

  it('redacts x-api-key values', () => {
    const result = sanitizeErrorText('x-api-key: sk-abc123def456');
    expect(result).toContain('[REDACTED]');
  });

  it('truncates long strings to 500 chars', () => {
    const longString = 'a'.repeat(1000);
    const result = sanitizeErrorText(longString);
    expect(result.length).toBe(500);
  });

  it('passes through safe error text unchanged', () => {
    const safeText = 'Payment failed: insufficient balance';
    const result = sanitizeErrorText(safeText);
    expect(result).toBe(safeText);
  });

  it('handles empty string', () => {
    expect(sanitizeErrorText('')).toBe('');
  });
});
