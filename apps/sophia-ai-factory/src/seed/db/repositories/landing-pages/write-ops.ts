import { getD1 } from '@/seed/db/client';
import type {
  LandingPage,
  CreateLandingPageInput,
  UpdateLandingPageInput,
} from '@/seed/types/landing-page-types';
import { getBySlug } from './read-ops';

export { remove, togglePublish } from './mutate-ops';

/** Create a new landing page. Returns the created page. */
export async function create(input: CreateLandingPageInput): Promise<LandingPage> {
  const _db = await getD1();
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
  const _db = await getD1();
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
