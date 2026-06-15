import { getD1 } from '@/seed/db/client';

export interface MarketplaceTemplate {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  template_config: string;
  preview_r2_key: string | null;
  price_cents: number;
  downloads: number;
  rating: number;
  rating_count: number;
  is_public: number;
  created_at: string;
}

export async function createMarketplaceTemplate(input: {
  creatorId: string;
  title: string;
  description?: string;
  templateConfig: string;
  previewR2Key?: string;
  priceCents?: number;
}): Promise<MarketplaceTemplate> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  await db
    .prepare(
      `INSERT INTO marketplace_templates (id, creator_id, title, description, template_config, preview_r2_key, price_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.creatorId, input.title, input.description ?? null, input.templateConfig, input.previewR2Key ?? null, input.priceCents ?? 0)
    .run();

  return (await getMarketplaceTemplate(id))!;
}

export async function getMarketplaceTemplate(templateId: string): Promise<MarketplaceTemplate | null> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  return db
    .prepare('SELECT * FROM marketplace_templates WHERE id = ?')
    .bind(templateId)
    .first<MarketplaceTemplate>() ?? null;
}

export async function listPublicTemplates(
  limit: number = 20,
  offset: number = 0,
): Promise<MarketplaceTemplate[]> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const result = await db
    .prepare('SELECT * FROM marketplace_templates WHERE is_public = 1 ORDER BY downloads DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<MarketplaceTemplate>();
  return result.results ?? [];
}

export async function listUserTemplates(userId: string): Promise<MarketplaceTemplate[]> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
  const result = await db
    .prepare('SELECT * FROM marketplace_templates WHERE creator_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<MarketplaceTemplate>();
  return result.results ?? [];
}

export async function updateTemplateVisibility(
  templateId: string,
  creatorId: string,
  isPublic: boolean,
): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
  await db
    .prepare('UPDATE marketplace_templates SET is_public = ? WHERE id = ? AND creator_id = ?')
    .bind(isPublic ? 1 : 0, templateId, creatorId)
    .run();
}

export async function incrementTemplateDownloads(templateId: string): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
  await db
    .prepare('UPDATE marketplace_templates SET downloads = downloads + 1 WHERE id = ?')
    .bind(templateId)
    .run();
}

export async function updateTemplateRating(templateId: string, newRating: number): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
  await db
    .prepare(
      `UPDATE marketplace_templates
       SET rating = (rating * rating_count + ?) / (rating_count + 1),
           rating_count = rating_count + 1
       WHERE id = ?`,
    )
    .bind(newRating, templateId)
    .run();
}
