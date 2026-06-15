/**
 * Tests for help-video-store.ts
 * Verifies schema parsing + catalog query functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — factory must be self-contained (no outer variable references)
// ---------------------------------------------------------------------------

vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn().mockResolvedValue({
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }),
  }),
}));

import { getD1Raw } from '@/seed/db/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockDb(options: { firstResult?: unknown; allResults?: unknown[] } = {}) {
  const mockFirst = vi.fn().mockResolvedValue(options.firstResult ?? null);
  const mockAll = vi.fn().mockResolvedValue({ results: options.allResults ?? [] });
  const mockBind = vi.fn().mockReturnValue({ first: mockFirst, all: mockAll });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind, all: mockAll });
  return { prepare: mockPrepare, mockFirst, mockAll };
}

const SAMPLE_ROW = {
  id: 'hv_01',
  slug: 'welcome',
  title_en: 'Welcome to Sophia AI Factory',
  title_vi: 'Chào mừng đến Sophia AI Factory',
  description_en: 'Overview of the platform.',
  description_vi: 'Tổng quan về nền tảng.',
  r2_key: null,
  duration_sec: 90,
  category: 'getting-started',
  order_index: 1,
  published: 0 as 0 | 1,
  created_at: 1700000000,
};

// ---------------------------------------------------------------------------
// Schema tests (pure, no DB)
// ---------------------------------------------------------------------------

describe('HelpVideoSchema', () => {
  it('parses a valid row', async () => {
    const { HelpVideoSchema } = await import('./help-video-store');
    expect(() => HelpVideoSchema.parse(SAMPLE_ROW)).not.toThrow();
  });

  it('rejects negative duration_sec', async () => {
    const { HelpVideoSchema } = await import('./help-video-store');
    expect(() => HelpVideoSchema.parse({ ...SAMPLE_ROW, duration_sec: -1 })).toThrow();
  });

  it('rejects invalid published value', async () => {
    const { HelpVideoSchema } = await import('./help-video-store');
    expect(() => HelpVideoSchema.parse({ ...SAMPLE_ROW, published: 2 })).toThrow();
  });

  it('accepts published=1', async () => {
    const { HelpVideoSchema } = await import('./help-video-store');
    const video = HelpVideoSchema.parse({ ...SAMPLE_ROW, published: 1 as 0 | 1 });
    expect(video.published).toBe(1);
  });

  it('allows null r2_key', async () => {
    const { HelpVideoSchema } = await import('./help-video-store');
    const video = HelpVideoSchema.parse({ ...SAMPLE_ROW, r2_key: null });
    expect(video.r2_key).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Store query tests
// ---------------------------------------------------------------------------

describe('listAllHelpVideos', () => {
  beforeEach(() => {
    const db = makeMockDb({ allResults: [SAMPLE_ROW] });
    vi.mocked(getD1Raw).mockResolvedValue(db as unknown as D1Database);
  });

  it('returns parsed rows', async () => {
    const { listAllHelpVideos } = await import('./help-video-store');
    const videos = await listAllHelpVideos();
    expect(videos).toHaveLength(1);
    expect(videos[0].slug).toBe('welcome');
  });

  it('returns empty array when results is null', async () => {
    // Override all to return null results
    const allFn = vi.fn().mockResolvedValue({ results: null });
    const bindFn = vi.fn().mockReturnValue({ first: vi.fn(), all: allFn });
    vi.mocked(getD1Raw).mockResolvedValue({
      prepare: vi.fn().mockReturnValue({ bind: bindFn, all: allFn }),
    } as unknown as D1Database);

    const { listAllHelpVideos } = await import('./help-video-store');
    const videos = await listAllHelpVideos();
    expect(videos).toHaveLength(0);
  });
});

describe('listPublishedHelpVideos', () => {
  beforeEach(() => {
    const db = makeMockDb({ allResults: [] });
    vi.mocked(getD1Raw).mockResolvedValue(db as unknown as D1Database);
  });

  it('returns empty when no published videos', async () => {
    const { listPublishedHelpVideos } = await import('./help-video-store');
    const videos = await listPublishedHelpVideos();
    expect(videos).toHaveLength(0);
  });
});

describe('getHelpVideoBySlug', () => {
  beforeEach(() => {
    const db = makeMockDb({ firstResult: SAMPLE_ROW });
    vi.mocked(getD1Raw).mockResolvedValue(db as unknown as D1Database);
  });

  it('returns video for valid slug', async () => {
    const { getHelpVideoBySlug } = await import('./help-video-store');
    const video = await getHelpVideoBySlug('welcome');
    expect(video?.slug).toBe('welcome');
  });

  it('returns null for empty slug', async () => {
    const { getHelpVideoBySlug } = await import('./help-video-store');
    const video = await getHelpVideoBySlug('');
    expect(video).toBeNull();
  });

  it('returns null when row not found', async () => {
    const db = makeMockDb({ firstResult: null });
    vi.mocked(getD1Raw).mockResolvedValue(db as unknown as D1Database);
    const { getHelpVideoBySlug } = await import('./help-video-store');
    const video = await getHelpVideoBySlug('nonexistent');
    expect(video).toBeNull();
  });

  it('rejects slug over 100 chars', async () => {
    const { getHelpVideoBySlug } = await import('./help-video-store');
    const video = await getHelpVideoBySlug('a'.repeat(101));
    expect(video).toBeNull();
  });
});
