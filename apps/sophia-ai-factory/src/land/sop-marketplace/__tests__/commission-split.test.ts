/**
 * Unit tests for SOP Marketplace Commission Split
 *
 * Tests the creator/platform 70/30 split calculation and
 * commission_ledger recording with correct offer_id and payout hold.
 *
 * @module land/sop-marketplace/__tests__/commission-split
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { calculateCreatorCommission, recordSopSaleCommission } from '../commission-split';

describe('calculateCreatorCommission', () => {
  it('splits 19900 cents 70/30 (13930 creator / 5970 platform)', () => {
    const result = calculateCreatorCommission(19900);
    expect(result.creatorCents).toBe(13930);
    expect(result.platformCents).toBe(5970);
    expect(result.grossCents).toBe(19900);
    expect(result.commissionPct).toBe(0.7);
  });

  it('returns 0/0 for zero price', () => {
    const result = calculateCreatorCommission(0);
    expect(result.creatorCents).toBe(0);
    expect(result.platformCents).toBe(0);
    expect(result.grossCents).toBe(0);
  });

  it('throws RangeError for negative price', () => {
    expect(() => calculateCreatorCommission(-1)).toThrow(RangeError);
    expect(() => calculateCreatorCommission(-1)).toThrow('priceCents must be non-negative');
  });

  it('splits 399 cents into integer cents (279/120)', () => {
    const result = calculateCreatorCommission(399);
    expect(result.creatorCents).toBe(279);
    expect(result.platformCents).toBe(120);
    expect(result.grossCents).toBe(399);
  });

  it('handles large values without overflow', () => {
    const large = 10_000_000_000; // 100 million dollars in cents
    const result = calculateCreatorCommission(large);
    expect(result.creatorCents + result.platformCents).toBe(large);
    expect(result.creatorCents).toBe(7_000_000_000);
    expect(result.platformCents).toBe(3_000_000_000);
  });

  it('splits 1 cent correctly (0 creator / 1 platform floor)', () => {
    // Math.floor(1 * 0.7) = Math.floor(0.7) = 0
    // 1 - 0 = 1
    const result = calculateCreatorCommission(1);
    expect(result.creatorCents).toBe(0);
    expect(result.platformCents).toBe(1);
    expect(result.grossCents).toBe(1);
  });

  it('splits 2 cents correctly (1 creator / 1 platform)', () => {
    // Math.floor(2 * 0.7) = Math.floor(1.4) = 1
    // 2 - 1 = 1
    const result = calculateCreatorCommission(2);
    expect(result.creatorCents).toBe(1);
    expect(result.platformCents).toBe(1);
    expect(result.grossCents).toBe(2);
  });
});

const PAYOUT_DELAY_MS = 14 * 24 * 60 * 60 * 1000;

interface InsertCapture { sql: string; binds: unknown[] }
let insertCalls: InsertCapture[] = [];

function makeD1Mock() {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockImplementation((...binds: unknown[]) => {
        insertCalls.push({ sql, binds });
        return {
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
      }),
    })),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
  };
}

describe('recordSopSaleCommission', () => {
  beforeEach(() => { insertCalls = []; });

  it('inserts with offer_id=sop_marketplace', async () => {
    const db = makeD1Mock();
    await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'c1', listingId: 'l1', templateId: 't1', licenseId: 'lic1',
      priceCents: 19900, paymentId: 'p1',
    });
    const insert = insertCalls.find((c) => c.sql.includes('INSERT'));
    expect(insert).toBeDefined();
    expect(insert!.sql).toContain("'sop_marketplace'");
  });

  it('stores 70/30 split for 19900 cents', async () => {
    const db = makeD1Mock();
    await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'c2', listingId: 'l2', templateId: 't2', licenseId: 'lic2',
      priceCents: 19900, paymentId: 'p2',
    });
    const insert = insertCalls.find((c) => c.sql.includes('INSERT'));
    expect(insert!.binds[5]).toBe(0.7);
    expect(insert!.binds[6]).toBe(13930);
  });

  it('sets payable_at 14 days in the future', async () => {
    const db = makeD1Mock();
    await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'c3', listingId: 'l3', templateId: 't3', licenseId: 'lic3',
      priceCents: 5000, paymentId: 'p3',
    });
    const insert = insertCalls.find((c) => c.sql.includes('INSERT'));
    const payableAt = insert!.binds[7] as number;
    const createdAt = insert!.binds[8] as number;
    expect(payableAt - createdAt).toBe(PAYOUT_DELAY_MS);
  });

  it('records status as pending', async () => {
    const db = makeD1Mock();
    await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'c4', listingId: 'l4', templateId: 't4', licenseId: 'lic4',
      priceCents: 3000, paymentId: 'p4',
    });
    const insert = insertCalls.find((c) => c.sql.includes('INSERT'));
    expect(insert!.sql).toContain("'pending'");
  });
});

