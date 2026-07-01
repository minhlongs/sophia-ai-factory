/**
 * Landing Pages Repository — typed CRUD for programmatic SEO landing pages.
 *
 * D1-backed repository following seed-layer pattern (getD1, .prepare().bind()).
 * Features/FAQ stored as JSON TEXT in D1, parsed/serialized at repo boundary.
 *
 * @module seed/db/repositories/landing-pages-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type {
  Feature,
  FaqItem,
  LandingPage,
  CreateLandingPageInput,
  UpdateLandingPageInput,
} from '@/seed/types/landing-page-types';

// ── Row Type ──────────────────────────────────────────────────────────────────────

interface LandingPageRow {
  id: string;
  niche_label: string;
  hero_title_en: string | null;
  hero_title_vi: string | null;
  hero_sub_en: string | null;
  hero_sub_vi: string | null;
  features_json: string | null;
  faq_json: string | null;
  meta_title_en: string | null;
  meta_title_vi: string | null;
  meta_desc_en: string | null;
  meta_desc_vi: string | null;
  is_published: number;
  created_at: string;
  updated_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function parseLandingPage(row: LandingPageRow): LandingPage {
  let features: Feature[] = [];
  let faq: FaqItem[] = [];

  try {
    if (row.features_json) features = JSON.parse(row.features_json) as Feature[];
  } catch {
    logger.warn('[LandingPagesRepo] Failed to parse features_json', { id: row.id });
  }

  try {
    if (row.faq_json) faq = JSON.parse(row.faq_json) as FaqItem[];
  } catch {
    logger.warn('[LandingPagesRepo] Failed to parse faq_json', { id: row.id });
  }

  return {
    id: row.id,
    nicheLabel: row.niche_label,
    heroTitleEn: row.hero_title_en,
    heroTitleVi: row.hero_title_vi,
    heroSubEn: row.hero_sub_en,
    heroSubVi: row.hero_sub_vi,
    features,
    faq,
    metaTitleEn: row.meta_title_en,
    metaTitleVi: row.meta_title_vi,
    metaDescEn: row.meta_desc_en,
    metaDescVi: row.meta_desc_vi,
    isPublished: row.is_published === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Read Operations ──────────────────────────────────────────────────────────────

/** Get a single landing page by slug. Returns null if not found. */
export async function getBySlug(slug: string): Promise<LandingPage | null> {
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;

    const row = await db
      .prepare(
        `SELECT id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi,
                features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi,
                is_published, created_at, updated_at
         FROM landing_pages
         WHERE id = ?1
         LIMIT 1`,
      )
      .bind(slug)
      .first<LandingPageRow>();

    return row ? parseLandingPage(row) : null;
  } catch (err) {
    logger.error('[LandingPagesRepo] getBySlug failed', {
      slug,
      error: getErrorMessage(err),
    });
    return null;
  }
}

/** List all landing pages, ordered by newest first. */
export async function listAll(): Promise<LandingPage[]> {
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;

    const result = await db
      .prepare(
        `SELECT id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi,
                features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi,
                is_published, created_at, updated_at
         FROM landing_pages
         ORDER BY created_at DESC`,
      )
      .all<LandingPageRow>();

    return (result.results ?? []).map(parseLandingPage);
  } catch (err) {
    logger.error('[LandingPagesRepo] listAll failed', { error: getErrorMessage(err) });
    return [];
  }
}

/** List only published landing pages. Used by generateStaticParams at build time. */
export async function listPublished(): Promise<LandingPage[]> {
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;

    const result = await db
      .prepare(
        `SELECT id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi,
                features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi,
                is_published, created_at, updated_at
         FROM landing_pages
         WHERE is_published = 1
         ORDER BY created_at DESC`,
      )
      .all<LandingPageRow>();

    return (result.results ?? []).map(parseLandingPage);
  } catch (err) {
    logger.error('[LandingPagesRepo] listPublished failed', { error: getErrorMessage(err) });
    return [];
  }
}

/** Get all slug IDs for generateStaticParams. Returns only published pages. */
export async function getAllSlugs(): Promise<string[]> {
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;

    const result = await db
      .prepare(`SELECT id FROM landing_pages WHERE is_published = 1`)
      .all<{ id: string }>();

    return (result.results ?? []).map((r) => r.id);
  } catch (err) {
    logger.error('[LandingPagesRepo] getAllSlugs failed', { error: getErrorMessage(err) });
    return [];
  }
}

// ── Write Operations ─────────────────────────────────────────────────────────────

/** Create a new landing page. Returns the created page. */
export async function create(input: CreateLandingPageInput): Promise<LandingPage> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;

  const featuresJson = input.features ? JSON.stringify(input.features) : '[]';
  const faqJson = input.faq ? JSON.stringify(input.faq) : '[]';
  const isPublished = input.isPublished ? 1 : 0;

  await db
    .prepare(
      `INSERT INTO landing_pages
         (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi,
          features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi,
          is_published)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    )
    .bind(
      input.id,
      input.nicheLabel,
      input.heroTitleEn ?? null,
      input.heroTitleVi ?? null,
      input.heroSubEn ?? null,
      input.heroSubVi ?? null,
      featuresJson,
      faqJson,
      input.metaTitleEn ?? null,
      input.metaTitleVi ?? null,
      input.metaDescEn ?? null,
      input.metaDescVi ?? null,
      isPublished,
    )
    .run();

  const page = await getBySlug(input.id);
  if (!page) throw new Error(`Failed to create landing page: ${input.id}`);
  return page;
}

/** Update an existing landing page. Returns the updated page or null if not found. */
export async function update(
  slug: string,
  input: UpdateLandingPageInput,
): Promise<LandingPage | null> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;

  const existing = await getBySlug(slug);
  if (!existing) return null;

  const featuresJson = input.features
    ? JSON.stringify(input.features)
    : JSON.stringify(existing.features);
  const faqJson = input.faq ? JSON.stringify(input.faq) : JSON.stringify(existing.faq);
  const isPublished = input.isPublished !== undefined
    ? (input.isPublished ? 1 : 0)
    : (existing.isPublished ? 1 : 0);

  await db
    .prepare(
      `UPDATE landing_pages
       SET niche_label = ?2,
           hero_title_en = ?3, hero_title_vi = ?4,
           hero_sub_en = ?5, hero_sub_vi = ?6,
           features_json = ?7, faq_json = ?8,
           meta_title_en = ?9, meta_title_vi = ?10,
           meta_desc_en = ?11, meta_desc_vi = ?12,
           is_published = ?13,
           updated_at = datetime('now')
       WHERE id = ?1`,
    )
    .bind(
      slug,
      input.nicheLabel ?? existing.nicheLabel,
      input.heroTitleEn ?? existing.heroTitleEn,
      input.heroTitleVi ?? existing.heroTitleVi,
      input.heroSubEn ?? existing.heroSubEn,
      input.heroSubVi ?? existing.heroSubVi,
      featuresJson,
      faqJson,
      input.metaTitleEn ?? existing.metaTitleEn,
      input.metaTitleVi ?? existing.metaTitleVi,
      input.metaDescEn ?? existing.metaDescEn,
      input.metaDescVi ?? existing.metaDescVi,
      isPublished,
    )
    .run();

  return getBySlug(slug);
}

/** Delete a landing page by slug. Returns true if deleted, false if not found. */
export async function remove(slug: string): Promise<boolean> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;

  const result = await db
    .prepare(`DELETE FROM landing_pages WHERE id = ?1`)
    .bind(slug)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/** Toggle is_published for a landing page. Returns the updated page. */
export async function togglePublish(slug: string): Promise<LandingPage | null> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;

  await db
    .prepare(
      `UPDATE landing_pages
       SET is_published = CASE WHEN is_published = 1 THEN 0 ELSE 1 END,
           updated_at = datetime('now')
       WHERE id = ?1`,
    )
    .bind(slug)
    .run();

  return getBySlug(slug);
}
