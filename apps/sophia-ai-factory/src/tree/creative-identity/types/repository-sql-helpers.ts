/**
 * SQL statement execution helpers for CreativeIdentity D1 repository.
 * @module tree/creative-identity/types/repository-sql-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { CreativeIdentityRow } from './models';

export async function insertCreativeIdentityRow(
  db: D1Database,
  row: CreativeIdentityRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO creative_identities
         (id, workspace_id, brand_id, voice_description, tone, formality, energy,
          beliefs, positioning, target_audience, forbidden_patterns, required_disclosures,
          preferred_formats, reference_works, version, is_active, created_at, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.workspace_id,
      row.brand_id,
      row.voice_description,
      row.tone,
      row.formality,
      row.energy,
      row.beliefs,
      row.positioning,
      row.target_audience,
      row.forbidden_patterns,
      row.required_disclosures,
      row.preferred_formats,
      row.reference_works,
      row.version,
      row.is_active,
      row.created_at,
      row.updated_at,
      row.updated_by,
    )
    .run();
}

export async function updateCreativeIdentityRow(
  db: D1Database,
  row: CreativeIdentityRow,
): Promise<void> {
  await db
    .prepare(`UPDATE creative_identities SET is_active = 0 WHERE workspace_id = ?1 AND id != ?2`)
    .bind(row.workspace_id, row.id)
    .run();

  await db
    .prepare(
      `UPDATE creative_identities SET
         voice_description = ?, tone = ?, formality = ?, energy = ?,
         beliefs = ?, positioning = ?, target_audience = ?,
         forbidden_patterns = ?, required_disclosures = ?,
         preferred_formats = ?, reference_works = ?,
         version = ?, is_active = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
    )
    .bind(
      row.voice_description,
      row.tone,
      row.formality,
      row.energy,
      row.beliefs,
      row.positioning,
      row.target_audience,
      row.forbidden_patterns,
      row.required_disclosures,
      row.preferred_formats,
      row.reference_works,
      row.version,
      row.is_active,
      row.updated_at,
      row.updated_by,
      row.id,
    )
    .run();
}
