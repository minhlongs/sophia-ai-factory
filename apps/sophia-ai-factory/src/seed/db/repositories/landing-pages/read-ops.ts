import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { LandingPage } from '@/seed/types/landing-page-types';
import { parseLandingPage, type LandingPageRow } from './types';

/** Get a single landing page by slug. Returns null if not found. */
export async function getBySlug(slug: string): Promise<LandingPage | null> {
  try {
    const _db = await getD1();
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
    const _db = await getD1();
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
    const _db = await getD1();
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
    const _db = await getD1();
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
