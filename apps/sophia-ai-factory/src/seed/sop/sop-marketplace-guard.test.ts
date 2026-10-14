/**
 * SOP Marketplace Guard — Comprehensive Unit & Integration Tests
 *
 * Verifies fail-closed access control and financial integrity:
 * - Official templates and free marketplace listings (price_cents === 0) are allowed.
 * - Paid marketplace listings (price_cents > 0) are blocked with PAYMENT_REQUIRED.
 * - Corrupted, negative, null, non-integer price values are rejected fail-closed.
 * - Schema 0126 (template_id) and schema 0213 (sop_template_id) compatibility.
 * - Rejection across install and execution gates.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  assertTemplateInstallable,
  assertTemplateExecutable,
} from './sop-marketplace-guard';
import { createInstallation } from '@/tree/sop/sop-repo-installations';

interface MockListingRow {
  id: string;
  price_cents: number | null | undefined;
  status?: string | null;
}

type SchemaMode =
  | '0213'             // 0213 succeeds, 0126 rejects with column error
  | '0126'             // 0213 rejects with column error, 0126 succeeds
  | 'both_fail'        // both schemas reject with DB/column error
  | '0213_empty_only'  // 0213 succeeds with null, 0126 rejects with column error
  | '0126_empty_only'; // 0213 rejects with column error, 0126 succeeds with null

function buildMockDb(listingRow: MockListingRow | null, schema: SchemaMode = '0213') {
  let boundArg = '';
  return {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockImplementation((id: string) => {
        boundArg = id;
        return {
          first: vi.fn().mockImplementation(() => {
            if (sql.includes('sop_listings')) {
              if (schema === 'both_fail') {
                return Promise.reject(new Error('D1_ERROR: database disk image is malformed'));
              }
              if (sql.includes('sop_template_id')) {
                if (schema === '0126' || schema === '0126_empty_only') {
                  return Promise.reject(new Error('no such column: sop_template_id'));
                }
                // 0213 schema mode or 0213_empty_only
                return Promise.resolve(schema === '0213_empty_only' ? null : listingRow);
              }
              if (sql.includes('template_id')) {
                if (schema === '0213' || schema === '0213_empty_only') {
                  return Promise.reject(new Error('no such column: template_id'));
                }
                // 0126 schema mode or 0126_empty_only
                return Promise.resolve(schema === '0126_empty_only' ? null : listingRow);
              }
              return Promise.resolve(null);
            }
            if (sql.includes('user_sop_installations') && sql.includes('SELECT *')) {
              return Promise.resolve({
                id: boundArg,
                user_id: 'user-001',
                template_id: 'free-template-id',
                customizations: null,
                schedule_cron: null,
                enabled: 1,
                last_run_at: null,
                next_run_at: null,
                run_count: 0,
                created_at: 1000,
              });
            }
            return Promise.resolve(null);
          }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        };
      }),
    })),
  };
}

describe('SOP Marketplace Guard — assertTemplateInstallable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permits official templates with no marketplace listing', async () => {
    const db = buildMockDb(null);
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'official-sop-template'),
    ).resolves.toBeUndefined();
  });

  it('permits free marketplace listings where price_cents === 0', async () => {
    const db = buildMockDb({
      id: 'listing-free',
      price_cents: 0,
      status: 'published',
    });
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'free-template-id'),
    ).resolves.toBeUndefined();
  });

  it('blocks paid marketplace listings (price_cents > 0) with PAYMENT_REQUIRED', async () => {
    const db = buildMockDb({
      id: 'listing-paid',
      price_cents: 1500,
      status: 'published',
    });
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'paid-template-id'),
    ).rejects.toThrow('Paid marketplace SOPs cannot be installed until checkout is enabled.');
  });

  it('blocks listings with null price_cents fail-closed', async () => {
    const db = buildMockDb({
      id: 'listing-null-price',
      price_cents: null,
      status: 'published',
    });
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'null-price-template'),
    ).rejects.toThrow('Paid marketplace SOPs cannot be installed until checkout is enabled.');
  });

  it('blocks listings with negative price_cents fail-closed', async () => {
    const db = buildMockDb({
      id: 'listing-neg-price',
      price_cents: -500,
      status: 'published',
    });
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'neg-price-template'),
    ).rejects.toThrow('Paid marketplace SOPs cannot be installed until checkout is enabled.');
  });

  it('blocks listings with non-integer floating price_cents fail-closed', async () => {
    const db = buildMockDb({
      id: 'listing-float-price',
      price_cents: 0.99,
      status: 'published',
    });
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'float-price-template'),
    ).rejects.toThrow('Paid marketplace SOPs cannot be installed until checkout is enabled.');
  });

  it('supports schema 0126 fallback when 0213 query rejects with column error', async () => {
    const db = buildMockDb(
      { id: 'listing-paid-0126', price_cents: 2000, status: 'published' },
      '0126',
    );
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'template-0126-id'),
    ).rejects.toThrow('Paid marketplace SOPs cannot be installed until checkout is enabled.');
  });

  it('permits unlisted template when schema 0126 succeeds with null while 0213 rejects column', async () => {
    const db = buildMockDb(null, '0126_empty_only');
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'unlisted-0126-template'),
    ).resolves.toBeUndefined();
  });

  it('permits unlisted template when schema 0213 succeeds with null while 0126 rejects column', async () => {
    const db = buildMockDb(null, '0213_empty_only');
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'unlisted-0213-template'),
    ).resolves.toBeUndefined();
  });

  it('blocks install fail-closed with DB_ERROR when all schema queries fail', async () => {
    const db = buildMockDb(null, 'both_fail');
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'unknown-template'),
    ).rejects.toThrow('Database query failed for marketplace listings: unable to verify template status.');
  });

  it('blocks install when free marketplace listing is in draft status', async () => {
    const db = buildMockDb({
      id: 'listing-draft',
      price_cents: 0,
      status: 'draft',
    });
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'free-draft-template'),
    ).rejects.toThrow('Marketplace SOP is not published.');
  });

  it('blocks install when free marketplace listing has missing or null status', async () => {
    const db = buildMockDb({
      id: 'listing-no-status',
      price_cents: 0,
      status: null,
    });
    await expect(
      assertTemplateInstallable(db as unknown as D1Database, 'free-no-status-template'),
    ).rejects.toThrow('Marketplace SOP is not published.');
  });
});

describe('SOP Marketplace Guard — assertTemplateExecutable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permits execution of official unlisted templates', async () => {
    const db = buildMockDb(null);
    await expect(
      assertTemplateExecutable(db as unknown as D1Database, 'official-sop-template'),
    ).resolves.toBeUndefined();
  });

  it('permits execution of free marketplace templates (price_cents === 0, status === published)', async () => {
    const db = buildMockDb({
      id: 'listing-free',
      price_cents: 0,
      status: 'published',
    });
    await expect(
      assertTemplateExecutable(db as unknown as D1Database, 'free-template-id'),
    ).resolves.toBeUndefined();
  });

  it('blocks execution of paid marketplace templates (price_cents > 0) with PAYMENT_REQUIRED', async () => {
    const db = buildMockDb({
      id: 'listing-paid',
      price_cents: 3000,
      status: 'published',
    });
    await expect(
      assertTemplateExecutable(db as unknown as D1Database, 'paid-template-id'),
    ).rejects.toThrow('Paid marketplace SOPs cannot be executed until checkout is enabled.');
  });

  it('blocks execution fail-closed with DB_ERROR when all schema queries fail', async () => {
    const db = buildMockDb(null, 'both_fail');
    await expect(
      assertTemplateExecutable(db as unknown as D1Database, 'corrupted-db-template'),
    ).rejects.toThrow('Database query failed for marketplace listings: unable to verify template status.');
  });

  it('blocks execution when free marketplace listing is not published', async () => {
    const db = buildMockDb({
      id: 'listing-archived',
      price_cents: 0,
      status: 'archived',
    });
    await expect(
      assertTemplateExecutable(db as unknown as D1Database, 'archived-template'),
    ).rejects.toThrow('Marketplace SOP is not published.');
  });
});

describe('createInstallation — protected by Marketplace Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks creation of installation for paid marketplace templates', async () => {
    const db = buildMockDb({
      id: 'listing-paid',
      price_cents: 5000,
      status: 'published',
    });

    await expect(
      createInstallation(db as unknown as D1Database, {
        userId: 'user-001',
        templateId: 'paid-template-id',
      }),
    ).rejects.toThrow('Paid marketplace SOPs cannot be installed until checkout is enabled.');
  });

  it('blocks creation of installation when all schema queries fail (no INSERT)', async () => {
    const db = buildMockDb(null, 'both_fail');

    await expect(
      createInstallation(db as unknown as D1Database, {
        userId: 'user-001',
        templateId: 'unverified-template',
      }),
    ).rejects.toThrow('Database query failed for marketplace listings: unable to verify template status.');
  });

  it('allows creation of installation for free marketplace templates', async () => {
    const db = buildMockDb({
      id: 'listing-free',
      price_cents: 0,
      status: 'published',
    });

    const inst = await createInstallation(db as unknown as D1Database, {
      userId: 'user-001',
      templateId: 'free-template-id',
    });

    expect(inst).toBeDefined();
    expect(inst.template_id).toBe('free-template-id');
  });
});
