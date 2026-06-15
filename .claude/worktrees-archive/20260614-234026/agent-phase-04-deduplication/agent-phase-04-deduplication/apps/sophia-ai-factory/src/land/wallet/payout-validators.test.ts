/**
 * Tests for payout-validators
 */

import { describe, it, expect } from 'vitest';
import {
  MIN_PAYOUT_USD,
  QueueQuerySchema,
  MarkPaidSchema,
  PAYOUT_METHODS,
} from './payout-validators';

describe('MIN_PAYOUT_USD', () => {
  it('should be 50', () => {
    expect(MIN_PAYOUT_USD).toBe(50);
  });
});

describe('PAYOUT_METHODS', () => {
  it('should include all 4 methods', () => {
    expect(PAYOUT_METHODS).toContain('usdt_trc20');
    expect(PAYOUT_METHODS).toContain('usdt_erc20');
    expect(PAYOUT_METHODS).toContain('bank_transfer');
    expect(PAYOUT_METHODS).toContain('other');
  });
});

describe('QueueQuerySchema', () => {
  it('defaults limit to 50', () => {
    const result = QueueQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(50);
  });

  it('parses limit from string', () => {
    const result = QueueQuerySchema.safeParse({ limit: '20' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(20);
  });

  it('rejects limit > 100', () => {
    const result = QueueQuerySchema.safeParse({ limit: '200' });
    expect(result.success).toBe(false);
  });

  it('rejects limit < 1', () => {
    const result = QueueQuerySchema.safeParse({ limit: '0' });
    expect(result.success).toBe(false);
  });

  it('accepts optional cursor', () => {
    const result = QueueQuerySchema.safeParse({ cursor: 'abc-123' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cursor).toBe('abc-123');
  });
});

describe('MarkPaidSchema', () => {
  // userId uses Better Auth format: lower(hex(randomblob(16))) = 32-char hex string
  const validBody = {
    userId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    amount: 100.5,
    method: 'usdt_trc20',
    reference: 'tx_abc123',
  };

  it('accepts valid payload', () => {
    const result = MarkPaidSchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it('accepts non-uuid userId (Better Auth 32-char hex format)', () => {
    // Users.id = lower(hex(randomblob(16))) — not standard UUID with dashes
    const result = MarkPaidSchema.safeParse({ ...validBody, userId: 'not-a-uuid-but-valid-string' });
    expect(result.success).toBe(true);
  });

  it('rejects empty userId', () => {
    const result = MarkPaidSchema.safeParse({ ...validBody, userId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects userId > 64 chars', () => {
    const result = MarkPaidSchema.safeParse({ ...validBody, userId: 'a'.repeat(65) });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const result = MarkPaidSchema.safeParse({ ...validBody, amount: -10 });
    expect(result.success).toBe(false);
  });

  it('rejects unknown method', () => {
    const result = MarkPaidSchema.safeParse({ ...validBody, method: 'paypal' });
    expect(result.success).toBe(false);
  });

  it('rejects reference > 200 chars', () => {
    const result = MarkPaidSchema.safeParse({ ...validBody, reference: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('rejects empty reference', () => {
    const result = MarkPaidSchema.safeParse({ ...validBody, reference: '' });
    expect(result.success).toBe(false);
  });

  it('accepts optional notes', () => {
    const result = MarkPaidSchema.safeParse({ ...validBody, notes: 'manual bank wire' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBe('manual bank wire');
  });

  it('rejects notes > 1000 chars', () => {
    const result = MarkPaidSchema.safeParse({ ...validBody, notes: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});
