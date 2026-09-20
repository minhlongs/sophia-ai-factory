import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { processAffiliateWebhook } from '../webhook-processor';
import { generateAffiliateHmac } from '../hmac-verifier';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS commission_ledger (
      id TEXT PRIMARY KEY,
      affiliate_id TEXT NOT NULL,
      network TEXT NOT NULL,
      external_conversion_id TEXT NOT NULL,
      sub_id TEXT,
      order_value_cents INTEGER NOT NULL DEFAULT 0,
      commission_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      hold_days INTEGER NOT NULL DEFAULT 14,
      attributed_at INTEGER NOT NULL,
      payable_at INTEGER NOT NULL,
      payout_batch_id TEXT,
      parent_id TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(network, external_conversion_id)
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0) } };
            },
            all: async <T>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0 } };
            },
          };
        },
        first: async <T>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0) } };
        },
        all: async <T>() => {
          return { results: stmt.all() as T[], meta: { changes: 0 } };
        },
      };
    },
  } as unknown as D1Database;
}

describe('Webhook Processor (tree/affiliate/webhook-processor)', () => {
  let db: D1Database;
  const secret = 'webhook_secret_xyz';

  beforeEach(() => {
    db = createTestDb();
  });

  it('rejects invalid HMAC signature with INVALID_HMAC_SIGNATURE', async () => {
    const rawBody = JSON.stringify({ conversionId: 'c1', commissionCents: 500 });
    const result = await processAffiliateWebhook({
      db,
      network: 'tiktok_shop',
      rawBody,
      signature: 'bad_signature',
      secret,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_HMAC_SIGNATURE');
  });

  it('rejects malformed non-JSON payload with MALFORMED_JSON_PAYLOAD', async () => {
    const rawBody = 'not a valid json payload';
    const signature = await generateAffiliateHmac(rawBody, secret);

    const result = await processAffiliateWebhook({
      db,
      network: 'tiktok_shop',
      rawBody,
      signature,
      secret,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('MALFORMED_JSON_PAYLOAD');
  });

  it('rejects zero or negative commission with ZERO_OR_NEGATIVE_COMMISSION', async () => {
    const rawZero = JSON.stringify({ conversionId: 'c_zero', commissionCents: 0 });
    const sigZero = await generateAffiliateHmac(rawZero, secret);

    const resZero = await processAffiliateWebhook({
      db,
      network: 'amazon_associates',
      rawBody: rawZero,
      signature: sigZero,
      secret,
    });
    expect(resZero.success).toBe(false);
    expect(resZero.error).toBe('ZERO_OR_NEGATIVE_COMMISSION');

    const rawNeg = JSON.stringify({ conversionId: 'c_neg', commissionCents: -500 });
    const sigNeg = await generateAffiliateHmac(rawNeg, secret);

    const resNeg = await processAffiliateWebhook({
      db,
      network: 'amazon_associates',
      rawBody: rawNeg,
      signature: sigNeg,
      secret,
    });
    expect(resNeg.success).toBe(false);
    expect(resNeg.error).toBe('ZERO_OR_NEGATIVE_COMMISSION');
  });

  it('processes valid conversion and enforces 14-day anti-fraud hold', async () => {
    const nowMs = 1_700_000_000_000;
    const rawBody = JSON.stringify({
      order_id: 'tts_order_777',
      affiliate_id: 'aff_creator_99',
      sub_id: 'camp_tiktok_viral_01',
      settlement_amount: 100.0,
      commission_amount: 15.5,
    });
    const signature = await generateAffiliateHmac(rawBody, secret);

    const result = await processAffiliateWebhook({
      db,
      network: 'tiktok_shop',
      rawBody,
      signature,
      secret,
      nowMs,
    });

    expect(result.success).toBe(true);
    expect(result.conversionId).toBe('tts_order_777');
    expect(result.affiliateId).toBe('aff_creator_99');
    expect(result.commissionCents).toBe(1550);
    expect(result.payableAt).toBe(nowMs + 14 * 86_400 * 1_000);
    expect(result.campaignId).toBe('camp_tiktok_viral_01');

    // Confirm persisted row in D1
    const row = await db
      .prepare('SELECT * FROM commission_ledger WHERE external_conversion_id = ?')
      .bind('tts_order_777')
      .first<{
        status: string;
        order_value_cents: number;
        commission_cents: number;
        hold_days: number;
      }>();

    expect(row?.status).toBe('pending');
    expect(row?.order_value_cents).toBe(10000);
    expect(row?.commission_cents).toBe(1550);
    expect(row?.hold_days).toBe(14);
  });
});
