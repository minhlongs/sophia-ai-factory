import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readJsonl: vi.fn(),
  getAuditBucket: vi.fn(),
}));

vi.mock('@/seed/utils/jsonl-append', () => ({
  readJsonl: mocks.readJsonl,
  getAuditBucket: mocks.getAuditBucket,
}));

import {
  byokAuditQuerySchema,
  queryByokAuditTrail,
  type ByokAuditEvent,
} from './byok-audit-query';

type AuditRecord = {
  ts: string;
  tenantId: string;
  event: string;
  provider: string;
  keyPrefix: string;
};

const record = (overrides: Partial<AuditRecord> = {}): AuditRecord => ({
  ts: '2026-10-17T00:00:00.000Z',
  tenantId: 'tenant-a',
  event: 'key.created',
  provider: 'openai',
  keyPrefix: 'sk-test',
  ...overrides,
});

function makeBucket(keys: string[] = []): Parameters<typeof queryByokAuditTrail>[0] {
  return {
    list: vi.fn().mockResolvedValue({ objects: keys.map((key) => ({ key })) }),
  } as unknown as Parameters<typeof queryByokAuditTrail>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readJsonl.mockResolvedValue({ total: 0, records: [] });
});

describe('byokAuditQuerySchema', () => {
  it('applies pagination defaults and accepts supported filters', () => {
    expect(byokAuditQuerySchema.parse({ event: 'key.rotated', from: '10' })).toEqual({
      event: 'key.rotated',
      from: 10,
      limit: 100,
      offset: 0,
    });
  });

  it('rejects unsupported events, malformed numbers, and out-of-range pagination', () => {
    expect(byokAuditQuerySchema.safeParse({ event: 'key.deleted' }).success).toBe(false);
    expect(byokAuditQuerySchema.safeParse({ from: '-1' }).success).toBe(false);
    expect(byokAuditQuerySchema.safeParse({ limit: 501 }).success).toBe(false);
    expect(byokAuditQuerySchema.safeParse({ offset: -1 }).success).toBe(false);
    expect(byokAuditQuerySchema.safeParse({ tenantId: 'x'.repeat(129) }).success).toBe(false);
  });
});

describe('queryByokAuditTrail', () => {
  it('reads one valid tenant file and applies event and timestamp filters', async () => {
    const bucket = makeBucket();
    const rows = [
      record({ event: 'key.created', ts: '2026-10-17T00:00:00.000Z' }),
      record({ event: 'key.revoked', ts: '2026-10-17T00:00:10.000Z' }),
      record({ event: 'key.created', ts: '2026-10-17T00:00:20.000Z' }),
    ];
    mocks.readJsonl.mockImplementation(async (
      _bucket: Parameters<typeof queryByokAuditTrail>[0],
      _key: string,
      filter: (entry: ByokAuditEvent) => boolean,
    ) => ({
      total: 2,
      records: rows.filter((row) => filter(row)),
    }));

    const result = await queryByokAuditTrail(bucket, {
      tenantId: 'tenant-a',
      event: 'key.created',
      from: Date.parse('2026-10-17T00:00:15.000Z') / 1000,
      limit: 10,
      offset: 0,
    });

    expect(mocks.readJsonl).toHaveBeenCalledWith(bucket, 'audit/byok/tenant-a.jsonl', expect.any(Function), 10, 0);
    expect(result.filters).toEqual({ tenantId: 'tenant-a', event: 'key.created', from: 1792195215 });
    expect(result.records).toEqual([rows[2]]);
    expect(result.count).toBe(2);
  });

  it('does not exclude records when the timestamp filter is zero or absent', async () => {
    const bucket = makeBucket();
    const rows = [record()];
    mocks.readJsonl.mockImplementation(async (
      _bucket: Parameters<typeof queryByokAuditTrail>[0],
      _key: string,
      filter: (entry: ByokAuditEvent) => boolean,
    ) => ({
      total: 1,
      records: rows.filter((row) => filter(row)),
    }));

    const result = await queryByokAuditTrail(bucket, {
      tenantId: 'tenant-a',
      limit: 10,
      offset: 0,
    });

    expect(result.records).toEqual(rows);
  });

  it('uses the empty tenant path for a supplied tenant ID that cannot be used as a path', async () => {
    const bucket = makeBucket();
    const rows = [record({ tenantId: 'other' })];
    mocks.readJsonl.mockResolvedValue({ total: 1, records: rows });

    const result = await queryByokAuditTrail(bucket, {
      tenantId: '../other',
      limit: 10,
      offset: 0,
    });

    expect(mocks.readJsonl).toHaveBeenCalledWith(bucket, 'audit/byok/.jsonl', expect.any(Function), 10, 0);
    expect(result.filters.tenantId).toBe('');
    expect(result.records).toEqual(rows);
  });

  it('lists tenant files, ignores non-JSONL objects, merges newest-first, and stops after filling the page', async () => {
    const bucket = makeBucket(['audit/byok/a.jsonl', 'audit/byok/readme.txt', 'audit/byok/b.jsonl']);
    const older = record({ tenantId: 'a', ts: '2026-10-17T00:00:00.000Z' });
    const newer = record({ tenantId: 'b', ts: '2026-10-17T00:00:30.000Z' });
    mocks.readJsonl
      .mockResolvedValueOnce({ total: 2, records: [older] })
      .mockResolvedValueOnce({ total: 3, records: [newer] });

    const result = await queryByokAuditTrail(bucket, { limit: 2, offset: 1 });

    expect(bucket.list).toHaveBeenCalledWith({ prefix: 'audit/byok/' });
    expect(mocks.readJsonl).toHaveBeenCalledTimes(2);
    expect(result.filters).toEqual({ tenantId: null, event: null, from: undefined });
    expect(result.count).toBe(5);
    expect(result.records).toEqual([newer, older]);
  });

  it('merges all listed tenant records when a page is not filled early', async () => {
    const bucket = makeBucket(['audit/byok/a.jsonl', 'audit/byok/b.jsonl']);
    const first = record({ tenantId: 'a', ts: '2026-10-17T00:00:00.000Z' });
    const second = record({ tenantId: 'b', ts: '2026-10-17T00:00:10.000Z' });
    mocks.readJsonl
      .mockResolvedValueOnce({ total: 1, records: [first] })
      .mockResolvedValueOnce({ total: 1, records: [second] });

    const result = await queryByokAuditTrail(bucket, { limit: 10, offset: 0 });

    expect(result.records).toEqual([second, first]);
    expect(result.count).toBe(2);
  });
});
