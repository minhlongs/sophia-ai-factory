/**
 * Tests for SOP Marketplace Payout Path
 *
 * Verifies that recordSopSaleCommission correctly inserts a
 * commission_ledger row with offer_id='sop_marketplace', the proper
 * 70/30 split, a 14-day payout hold, and 'pending' status.
 *
 * @module land/payouts/__tests__/marketplace-payout
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { recordSopSaleCommission } from '@/land/sop-marketplace/commission-split';

const PAYOUT_DELAY_SECONDS = 14 * 24 * 60 * 60; // 14 days in seconds

/** Captured INSERT call details for verification. */
interface InsertCapture {
  sql: string;
  binds: unknown[];
}

let insertCalls: InsertCapture[];

beforeEach(() => {
  insertCalls = [];
});

function makeD1Mock(captures: InsertCapture[]) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockImplementation((...binds: unknown[]) => {
        captures.push({ sql, binds: [...binds] });
        return {
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [], success: true }),
        };
      }),
      run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
    })),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
  };
}

describe('recordSopSaleCommission', () => {
  it('inserts a commission_ledger row with offer_id=sop_marketplace', async () => {
    const db = makeD1Mock(insertCalls);

    const ledgerId = await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'creator-payout-1',
      listingId: 'listing-payout-1',
      templateId: 'tpl-payout-1',
      licenseId: 'license-payout-1',
      priceCents: 19900,
      paymentId: 'manual_payout_1',
    });

    expect(ledgerId).toBeDefined();
    expect(typeof ledgerId).toBe('string');
    expect(ledgerId.length).toBeGreaterThan(0);

    // Verify the INSERT SQL has the right columns and values
    const insert = insertCalls.find((c) => c.sql.includes('INSERT INTO commission_ledger'));
    expect(insert).toBeDefined();
    expect(insert!.sql).toContain("'sop_marketplace'");

    // binds: [id, tenant_id, affiliate_id, conversion_event_id, price_cents, commission_pct, commission_cents, payable_at, now, now]
    expect(insert!.binds[1]).toBe('default'); // tenant_id
    expect(insert!.binds[2]).toBe('creator-payout-1'); // affiliate_id (= creator)
    expect(insert!.binds[3]).toBe('license-payout-1'); // conversion_event_id (= license_id)
    expect(insert!.binds[4]).toBe(19900); // gross_cents
  });

  it('stores the correct 70/30 split for 19900 cents', async () => {
    const db = makeD1Mock(insertCalls);

    await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'creator-payout-2',
      listingId: 'listing-payout-2',
      templateId: 'tpl-payout-2',
      licenseId: 'license-payout-2',
      priceCents: 19900,
      paymentId: 'manual_payout_2',
    });

    const insert = insertCalls.find((c) => c.sql.includes('INSERT INTO commission_ledger'));
    expect(insert).toBeDefined();

    // binds index: 4=gross_cents, 5=commission_pct, 6=commission_cents
    expect(insert!.binds[4]).toBe(19900); // gross_cents
    expect(insert!.binds[5]).toBe(0.7); // commission_pct (70%)
    expect(insert!.binds[6]).toBe(13930); // commission_cents (70% of 19900)
    expect(insert!.sql).toContain('0'); // withheld_cents = 0 (inline in SQL)
  });

  it('sets payable_at 14 days in the future', async () => {
    const before = Math.floor(Date.now() / 1000);
    const db = makeD1Mock(insertCalls);

    await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'creator-payout-3',
      listingId: 'listing-payout-3',
      templateId: 'tpl-payout-3',
      licenseId: 'license-payout-3',
      priceCents: 5000,
      paymentId: 'manual_payout_3',
    });

    const insert = insertCalls.find((c) => c.sql.includes('INSERT INTO commission_ledger'));
    expect(insert).toBeDefined();

    // binds index 7 = payable_at, index 8 = created_at (= now)
    const payableAt = insert!.binds[7] as number;
    const createdAt = insert!.binds[8] as number;

    expect(payableAt - createdAt).toBe(PAYOUT_DELAY_SECONDS);
    expect(payableAt).toBeGreaterThan(before + PAYOUT_DELAY_SECONDS - 10);
  });

  it('records the row status as pending', async () => {
    const db = makeD1Mock(insertCalls);

    await recordSopSaleCommission(db as unknown as D1Database, {
      creatorId: 'creator-payout-4',
      listingId: 'listing-payout-4',
      templateId: 'tpl-payout-4',
      licenseId: 'license-payout-4',
      priceCents: 3000,
      paymentId: 'manual_payout_4',
    });

    const insert = insertCalls.find((c) => c.sql.includes('INSERT INTO commission_ledger'));
    expect(insert).toBeDefined();

    // SQL should contain 'pending' status
    expect(insert!.sql).toContain("'pending'");
  });
});
