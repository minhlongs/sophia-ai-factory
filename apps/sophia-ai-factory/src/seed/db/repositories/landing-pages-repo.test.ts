/**
 * Landing Pages Repository Tests — unit tests for D1-backed CRUD.
 *
 * Covers:
 *   - getBySlug() found / not found / D1 error
 *   - listAll() normal / empty / D1 error
 *   - listPublished() filters unpublished
 *   - getAllSlugs() returns only published slugs
 *   - create() inserts and returns the new page
 *   - update() partial / full / not found
 *   - remove() deleted / not found
 *   - togglePublish() flips is_published
 *
 * @module seed/db/repositories/landing-pages-repo.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mock for getD1
const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  getBySlug,
  listAll,
  listPublished,
  getAllSlugs,
  create,
  update,
  remove,
  togglePublish,
} from './landing-pages-repo';

import type { CreateLandingPageInput, UpdateLandingPageInput } from '@/seed/types/landing-page-types';

// ── Helpers ──────────────────────────────────────────────────────────────

interface D1Chain {
  run: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  bind: ReturnType<typeof vi.fn>;
  prepare: ReturnType<typeof vi.fn>;
}

function makeD1Chain(): D1Chain {
  const run = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
  const all = vi.fn().mockResolvedValue({ results: [] });
  const first = vi.fn().mockResolvedValue(null);
  const bind = vi.fn().mockReturnValue({ run, all, first });
  const prepare = vi.fn().mockReturnValue({ bind, run, all, first });
  return { prepare, bind, run, all, first };
}

const SAMPLE_ROW = {
  id: 'real-estate',
  niche_label: 'Real Estate / Bất Động Sản',
  hero_title_en: 'AI Video for Real Estate',
  hero_title_vi: 'Video AI Cho Bất Động Sản',
  hero_sub_en: 'Generate stunning property videos',
  hero_sub_vi: 'Tạo video bất động sản ấn tượng',
  features_json: JSON.stringify([
    { icon: 'home', title_en: 'Virtual Tours', title_vi: 'Tham quan ảo', desc_en: 'Show properties', desc_vi: 'Trình bày bất động sản' },
  ]),
  faq_json: JSON.stringify([
    { question_en: 'How does it work?', question_vi: 'Nó hoạt động thế nào?', answer_en: 'It works', answer_vi: 'Nó hoạt động' },
  ]),
  meta_title_en: 'AI Video for Real Estate Agents',
  meta_title_vi: 'Video AI Cho Môi Giới Bất Động Sản',
  meta_desc_en: 'Transform your real estate marketing with AI-generated videos.',
  meta_desc_vi: 'Biến đổi tiếp thị bất động sản với video AI.',
  is_published: 1,
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
};

describe('landing-pages-repo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBySlug', () => {
    it('returns the parsed page when found', async () => {
      const db = makeD1Chain();
      db.first.mockResolvedValue(SAMPLE_ROW);
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await getBySlug('real-estate');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('real-estate');
      expect(result!.nicheLabel).toBe('Real Estate / Bất Động Sản');
      expect(result!.features).toHaveLength(1);
      expect(result!.faq).toHaveLength(1);
      expect(result!.isPublished).toBe(true);
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
    });

    it('returns null when not found', async () => {
      const db = makeD1Chain();
      db.first.mockResolvedValue(null);
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await getBySlug('nonexistent');

      expect(result).toBeNull();
    });

    it('returns null when D1 binding is unavailable', async () => {
      mockGetD1.mockReturnValue(null);

      const result = await getBySlug('real-estate');

      expect(result).toBeNull();
    });

    it('returns null when D1 .first() throws', async () => {
      const db = makeD1Chain();
      db.first.mockRejectedValue(new Error('D1 failure'));
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await getBySlug('real-estate');

      expect(result).toBeNull();
    });
  });

  describe('listAll', () => {
    it('returns all pages ordered by created_at DESC', async () => {
      const db = makeD1Chain();
      const row2 = { ...SAMPLE_ROW, id: 'e-commerce', niche_label: 'E-Commerce' };
      db.all.mockResolvedValue({ results: [SAMPLE_ROW, row2] });
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await listAll();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('real-estate');
      expect(result[1].id).toBe('e-commerce');
    });

    it('returns empty array when no pages exist', async () => {
      const db = makeD1Chain();
      db.all.mockResolvedValue({ results: [] });
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await listAll();

      expect(result).toEqual([]);
    });

    it('returns empty array when D1 binding is unavailable', async () => {
      mockGetD1.mockReturnValue(null);

      const result = await listAll();

      expect(result).toEqual([]);
    });
  });

  describe('listPublished', () => {
    it('returns only published pages', async () => {
      const db = makeD1Chain();
      db.all.mockResolvedValue({ results: [SAMPLE_ROW] });
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await listPublished();

      expect(result).toHaveLength(1);
      expect(result[0].isPublished).toBe(true);
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('is_published = 1'));
    });

    it('excludes unpublished pages', async () => {
      const db = makeD1Chain();
      db.all.mockResolvedValue({ results: [] });
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await listPublished();

      expect(result).toEqual([]);
    });
  });

  describe('getAllSlugs', () => {
    it('returns string array of published slug IDs', async () => {
      const db = makeD1Chain();
      db.all.mockResolvedValue({ results: [{ id: 'real-estate' }, { id: 'e-commerce' }] });
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await getAllSlugs();

      expect(result).toEqual(['real-estate', 'e-commerce']);
    });

    it('returns empty array when none published', async () => {
      const db = makeD1Chain();
      db.all.mockResolvedValue({ results: [] });
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await getAllSlugs();

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const validInput: CreateLandingPageInput = {
      id: 'new-niche',
      nicheLabel: 'New Niche / Ngách Mới',
      heroTitleEn: 'AI Video for New Niche',
      heroTitleVi: 'Video AI Cho Ngách Mới',
      features: [{ icon: 'star', title_en: 'Feature', title_vi: 'Tính năng', desc_en: 'Desc', desc_vi: 'Mô tả' }],
      isPublished: false,
    };

    it('inserts a row and returns the created page', async () => {
      const db = makeD1Chain();
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);
      // create calls getBySlug internally after insert — mock that to return the new page
      const insertedRow = {
        ...SAMPLE_ROW,
        id: 'new-niche',
        niche_label: 'New Niche / Ngách Mới',
        hero_title_en: 'AI Video for New Niche',
        is_published: 0,
      };
      // create() calls getBySlug AFTER insert to verify — return the inserted row
      db.first.mockResolvedValue(insertedRow);

      const result = await create(validInput);

      expect(result.id).toBe('new-niche');
      expect(result.isPublished).toBe(false);
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO landing_pages'));
    });

    it('throws when D1 binding is unavailable', async () => {
      mockGetD1.mockReturnValue(null);

      await expect(create(validInput)).rejects.toThrow('D1 binding not available');
    });
  });

  describe('update', () => {
    it('updates fields and returns the updated page', async () => {
      const db = makeD1Chain();
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);
      // First first() call for getBySlug inside update
      db.first
        .mockResolvedValueOnce(SAMPLE_ROW)
        .mockResolvedValueOnce({ ...SAMPLE_ROW, hero_title_en: 'Updated Title' });

      const input: UpdateLandingPageInput = { heroTitleEn: 'Updated Title' };
      const result = await update('real-estate', input);

      expect(result).not.toBeNull();
      expect(result!.heroTitleEn).toBe('Updated Title');
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE landing_pages'));
    });

    it('returns null when slug does not exist', async () => {
      const db = makeD1Chain();
      db.first.mockResolvedValue(null);
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await update('nonexistent', { nicheLabel: 'New Label' });

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('returns true when a row was deleted', async () => {
      const db = makeD1Chain();
      db.run.mockResolvedValue({ success: true, meta: { changes: 1 } });
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await remove('real-estate');

      expect(result).toBe(true);
    });

    it('returns false when no row was deleted', async () => {
      const db = makeD1Chain();
      db.run.mockResolvedValue({ success: true, meta: { changes: 0 } });
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);

      const result = await remove('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('togglePublish', () => {
    it('toggles is_published from 0 to 1', async () => {
      const db = makeD1Chain();
      const toggledRow = { ...SAMPLE_ROW, is_published: 1, id: 'real-estate' };
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);
      // togglePublish runs UPDATE then calls getBySlug — return the toggled row
      db.first.mockResolvedValue(toggledRow);
      // All other first() calls (e.g. from update/remove in other tests) also return this

      const result = await togglePublish('real-estate');

      expect(result).not.toBeNull();
      expect(result!.isPublished).toBe(true);
    });

    it('returns null when slug does not exist', async () => {
      const db = makeD1Chain();
      mockGetD1.mockReturnValue(db as unknown as ReturnType<typeof mockGetD1>);
      // getBySlug (called inside togglePublish after UPDATE) returns null
      db.first.mockResolvedValue(null);

      const result = await togglePublish('nonexistent');

      expect(result).toBeNull();
    });
  });
});
