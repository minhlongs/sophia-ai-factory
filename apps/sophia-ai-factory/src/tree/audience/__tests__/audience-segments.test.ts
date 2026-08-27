/**
 * Audience segment model tests — Zod validation rejections + persistence.
 * D1 is mocked via vi.mock('@/seed/db/client').
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrepare = vi.fn().mockReturnThis();
const mockBind = vi.fn().mockReturnThis();
const mockRun = vi.fn();
const mockAll = vi.fn();

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    prepare: mockPrepare,
    bind: mockBind,
    run: mockRun,
    all: mockAll,
  }),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  AudienceSegmentInputSchema,
  createSegment,
  listSegments,
  parseSegmentRow,
  type AudienceSegmentRow,
} from '../audience-segments';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnThis();
  mockBind.mockReturnThis();
});

describe('AudienceSegmentInputSchema', () => {
  it('accepts a valid segment input', () => {
    const parsed = AudienceSegmentInputSchema.safeParse({
      workspaceId: 'ws-1',
      name: 'Gen-Z shorts fans',
      platforms: ['tiktok'],
      contentTypes: ['short_video'],
      ageBuckets: ['18-24'],
      countries: ['VN'],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown platform', () => {
    const parsed = AudienceSegmentInputSchema.safeParse({
      workspaceId: 'ws-1',
      name: 'Bad platform',
      platforms: ['myspace'],
      contentTypes: ['short_video'],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown content type', () => {
    const parsed = AudienceSegmentInputSchema.safeParse({
      workspaceId: 'ws-1',
      name: 'Bad content type',
      platforms: ['tiktok'],
      contentTypes: ['hologram'],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an empty platforms array', () => {
    const parsed = AudienceSegmentInputSchema.safeParse({
      workspaceId: 'ws-1',
      name: 'No platforms',
      platforms: [],
      contentTypes: ['short_video'],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an empty workspaceId', () => {
    const parsed = AudienceSegmentInputSchema.safeParse({
      workspaceId: '',
      name: 'No workspace',
      platforms: ['tiktok'],
      contentTypes: ['short_video'],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a country code that is not 2 characters', () => {
    const parsed = AudienceSegmentInputSchema.safeParse({
      workspaceId: 'ws-1',
      name: 'Bad country',
      platforms: ['tiktok'],
      contentTypes: ['short_video'],
      countries: ['VIETNAM'],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('createSegment', () => {
  it('returns INVALID_INPUT failure for bad input (no throw)', async () => {
    const result = await createSegment({
      workspaceId: '',
      name: 'x',
      platforms: [],
      contentTypes: [],
      ageBuckets: [],
      countries: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('persists a valid segment and returns it', async () => {
    mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });
    const result = await createSegment({
      workspaceId: 'ws-1',
      name: 'Gen-Z shorts fans',
      platforms: ['tiktok', 'youtube'],
      contentTypes: ['short_video'],
      ageBuckets: ['18-24'],
      countries: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toMatch(/^seg_/);
      expect(result.value.platforms).toEqual(['tiktok', 'youtube']);
      expect(result.value.createdAt).toBe(result.value.updatedAt);
    }
    expect(mockPrepare).toHaveBeenCalledTimes(1);
  });

  it('returns INSERT_FAILED when the DB write throws', async () => {
    mockRun.mockRejectedValueOnce(new Error('D1 write error'));
    const result = await createSegment({
      workspaceId: 'ws-1',
      name: 'Boom',
      platforms: ['tiktok'],
      contentTypes: ['short_video'],
      ageBuckets: [],
      countries: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INSERT_FAILED');
      expect(result.error.message).toBe('D1 write error');
    }
  });
});

describe('listSegments', () => {
  it('parses rows into typed segments', async () => {
    const row: AudienceSegmentRow = {
      id: 'seg_1',
      workspace_id: 'ws-1',
      name: 'Parsed',
      platforms: '["tiktok"]',
      content_types: '["short_video"]',
      age_buckets: '["18-24"]',
      countries: '[]',
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };
    mockAll.mockResolvedValueOnce({ results: [row] });
    const result = await listSegments('ws-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(parseSegmentRow(row)).toEqual({
        id: 'seg_1',
        workspaceId: 'ws-1',
        name: 'Parsed',
        platforms: ['tiktok'],
        contentTypes: ['short_video'],
        ageBuckets: ['18-24'],
        countries: [],
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      });
    }
  });

  it('returns an empty array when no segments exist', async () => {
    mockAll.mockResolvedValueOnce({ results: [] });
    const result = await listSegments('ws-empty');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it('returns QUERY_FAILED when the DB read throws', async () => {
    mockAll.mockRejectedValueOnce(new Error('no such table'));
    const result = await listSegments('ws-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('QUERY_FAILED');
  });
});
