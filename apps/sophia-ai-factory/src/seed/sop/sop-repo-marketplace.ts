/**
 * SOP Marketplace Repository
 * Listings (pricing/metadata) + Licenses (purchase records) CRUD.
 */

import type { SopListingRow, SopLicenseRow, CreateListingInput, CreateLicenseInput } from './sop-types';

/** Unix epoch seconds (consistent with all other SOP repos) */
function nowSec(): number { return Math.floor(Date.now() / 1000); }

/** Get listing by template ID */
export async function getListingByTemplateId(db: D1Database, templateId: string): Promise<SopListingRow | null> {
  const row = await db.prepare(`SELECT * FROM sop_listings WHERE template_id = ?1 LIMIT 1`)
    .bind(templateId).first<SopListingRow>();
  return row ?? null;
}

/** List published marketplace listings with optional filters */
export async function listPublishedListings(
  db: D1Database,
  opts?: { category?: string; limit?: number; offset?: number }
): Promise<(SopListingRow & { name_en: string; name_vi: string; slug: string; category: string; author_user_id: string | null })[]> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  let sql = `
    SELECT l.*, t.name_en, t.name_vi, t.slug, t.category, t.author_user_id
    FROM sop_listings l
    JOIN sop_templates t ON t.id = l.template_id
    WHERE l.status = 'published' AND t.status = 'published'
  `;
  const binds: unknown[] = [];

  if (opts?.category) {
    binds.push(opts.category);
    sql += ` AND t.category = ?${binds.length}`;
  }

  sql += ` ORDER BY l.published_at DESC LIMIT ?${binds.length + 1} OFFSET ?${binds.length + 2}`;
  binds.push(limit, offset);

  const stmt = db.prepare(sql);
   
  const { results } = await (binds.length > 0 ? stmt.bind(...binds) : stmt).all();
  // D1 returns untyped rows for dynamic JOIN queries; cast is intentional
   
  return results as unknown as (SopListingRow & { name_en: string; name_vi: string; slug: string; category: string; author_user_id: string | null })[];
}

/** Create a new listing for a community SOP */
export async function createListing(db: D1Database, input: CreateListingInput): Promise<SopListingRow> {
  const id = crypto.randomUUID();
  const now = nowSec();
  const tags = input.tags ? JSON.stringify(input.tags) : null;

  await db.prepare(`
    INSERT INTO sop_listings (id, template_id, price_cents, currency, preview_md, demo_video_url, tags, status, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending_review', ?8, ?8)
  `).bind(id, input.templateId, input.priceCents, input.currency ?? 'USD', input.previewMd ?? null, input.demoVideoUrl ?? null, tags, now).run();

  return (await db.prepare(`SELECT * FROM sop_listings WHERE id = ?1`).bind(id).first<SopListingRow>())!;
}

/** Update listing status (admin review) */
export async function updateListingStatus(
  db: D1Database, id: string, status: string, reason?: string
): Promise<void> {
  const now = nowSec();
  const publishedAt = status === 'published' ? now : null;
  await db.prepare(`
    UPDATE sop_listings SET status = ?1, rejection_reason = ?2, published_at = COALESCE(?3, published_at), updated_at = ?4
    WHERE id = ?5
  `).bind(status, reason ?? null, publishedAt, now, id).run();
}

/** Increment sales counter + revenue on listing */
export async function incrementSales(db: D1Database, listingId: string, priceCents: number): Promise<void> {
  await db.prepare(`
    UPDATE sop_listings SET total_sales = total_sales + 1, total_revenue_cents = total_revenue_cents + ?1, updated_at = ?2
    WHERE id = ?3
  `).bind(priceCents, nowSec(), listingId).run();
}

/** Create a purchase license */
export async function createLicense(db: D1Database, input: CreateLicenseInput): Promise<SopLicenseRow> {
  const id = crypto.randomUUID();
  const now = nowSec();
  await db.prepare(`
    INSERT INTO sop_licenses (id, user_id, template_id, listing_id, price_cents, payment_id, payment_status, purchased_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7)
  `).bind(id, input.userId, input.templateId, input.listingId, input.priceCents, input.paymentId ?? null, now).run();

  return (await db.prepare(`SELECT * FROM sop_licenses WHERE id = ?1`).bind(id).first<SopLicenseRow>())!;
}

/** Mark a license as paid */
export async function markLicensePaid(db: D1Database, licenseId: string, paymentId: string): Promise<void> {
  await db.prepare(`UPDATE sop_licenses SET payment_status = 'paid', payment_id = ?1 WHERE id = ?2`)
    .bind(paymentId, licenseId).run();
}

/** Check if user has purchased a template (paid license only) */
export async function getUserLicense(db: D1Database, userId: string, templateId: string): Promise<SopLicenseRow | null> {
  const row = await db.prepare(`SELECT * FROM sop_licenses WHERE user_id = ?1 AND template_id = ?2 AND payment_status = 'paid' LIMIT 1`)
    .bind(userId, templateId).first<SopLicenseRow>();
  return row ?? null;
}

/** List all paid licenses for a user */
export async function listUserLicenses(db: D1Database, userId: string): Promise<SopLicenseRow[]> {
  const { results } = await db.prepare(`SELECT * FROM sop_licenses WHERE user_id = ?1 AND payment_status = 'paid' ORDER BY purchased_at DESC LIMIT 100`)
    .bind(userId).all<SopLicenseRow>();
  return results;
}

/** List sales for a creator (by template author_user_id) */
export async function listCreatorSales(db: D1Database, creatorId: string): Promise<(SopLicenseRow & { name_en: string })[]> {
  const { results } = await db.prepare(`
    SELECT sl.*, t.name_en
    FROM sop_licenses sl
    JOIN sop_templates t ON t.id = sl.template_id
    WHERE t.author_user_id = ?1 AND sl.payment_status = 'paid'
    ORDER BY sl.purchased_at DESC
  `).bind(creatorId).all();
  // D1 returns untyped rows for JOIN queries; cast is intentional
   
  return results as unknown as (SopLicenseRow & { name_en: string })[];
}
