/**
 * Creative Identity Module
 * Layer: tree (domain-specific reusable)
 *
 * Manages CreativeIdentity CRUD + versioning for Sophia 2027.
 * Thin domain wrapper over seed/types/creative-domain CreativeIdentity.
 *
 * @module tree/creative-identity
 */

import { getD1 } from '@/seed/db/client';
import { CreativeIdentity } from '@/seed/types/creative-domain';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CreativeIdentityError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CreativeIdentityError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface CreativeIdentityRow {
  id: string;
  workspace_id: string;
  brand_id: string | null;
  voice_description: string;
  tone: string;
  formality: number;
  energy: number;
  beliefs: string;
  positioning: string;
  target_audience: string;
  forbidden_patterns: string;
  required_disclosures: string;
  preferred_formats: string;
  reference_works: string;
  version: number;
  is_active: number;
  created_at: number;
  updated_at: number;
  updated_by: string;
}

function rowToDomain(row: CreativeIdentityRow): CreativeIdentity {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    brandId: row.brand_id ?? undefined,
    voiceDescription: row.voice_description,
    tone: row.tone as CreativeIdentity['tone'],
    formality: row.formality,
    energy: row.energy,
    beliefs: JSON.parse(row.beliefs) as string[],
    positioning: row.positioning,
    targetAudience: row.target_audience,
    forbiddenPatterns: JSON.parse(row.forbidden_patterns) as string[],
    requiredDisclosures: JSON.parse(row.required_disclosures) as string[],
    preferredFormats: JSON.parse(row.preferred_formats) as CreativeIdentity['preferredFormats'],
    referenceWorks: JSON.parse(row.reference_works) as string[],
    version: row.version,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function domainToRow(identity: CreativeIdentity): Omit<CreativeIdentityRow, 'created_at' | 'updated_at'> & { created_at: number; updated_at: number } {
  return {
    id: identity.id,
    workspace_id: identity.workspaceId,
    brand_id: identity.brandId ?? null,
    voice_description: identity.voiceDescription,
    tone: identity.tone,
    formality: identity.formality,
    energy: identity.energy,
    beliefs: JSON.stringify(identity.beliefs),
    positioning: identity.positioning,
    target_audience: identity.targetAudience,
    forbidden_patterns: JSON.stringify(identity.forbiddenPatterns),
    required_disclosures: JSON.stringify(identity.requiredDisclosures),
    preferred_formats: JSON.stringify(identity.preferredFormats),
    reference_works: JSON.stringify(identity.referenceWorks),
    version: identity.version,
    is_active: identity.isActive ? 1 : 0,
    created_at: identity.createdAt,
    updated_at: identity.updatedAt,
    updated_by: identity.updatedBy,
  };
}

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

export function newIdentityId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'ci_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

/**
 * Get the active CreativeIdentity for a workspace.
 */
export async function getActiveIdentity(workspaceId: string): Promise<CreativeIdentity | null> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db
    .prepare(`SELECT * FROM creative_identities WHERE workspace_id = ?1 AND is_active = 1 ORDER BY version DESC LIMIT 1`)
    .bind(workspaceId)
    .first<CreativeIdentityRow>();

  if (!row) return null;
  return rowToDomain(row);
}

/**
 * Get a specific identity by id.
 */
export async function getIdentity(id: string): Promise<CreativeIdentity | null> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db
    .prepare(`SELECT * FROM creative_identities WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<CreativeIdentityRow>();

  if (!row) return null;
  return rowToDomain(row);
}

/**
 * List all versions for a workspace.
 */
export async function listIdentityVersions(workspaceId: string): Promise<CreativeIdentity[]> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(`SELECT * FROM creative_identities WHERE workspace_id = ?1 ORDER BY version DESC`)
    .bind(workspaceId)
    .all<CreativeIdentityRow>();

  return (result.results ?? []).map(rowToDomain);
}

/**
 * Create a new identity version.
 * Deactivates previous versions automatically.
 */
export async function createIdentity(identity: CreativeIdentity): Promise<CreativeIdentity> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  identity.createdAt = now;
  identity.updatedAt = now;
  identity.version = 1;

  const row = domainToRow(identity);

  try {
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
  } catch (err) {
    throw new CreativeIdentityError('INSERT_FAILED', `Failed to create identity: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return identity;
}

/**
 * Update an existing identity, bumping version and deactivating old versions.
 */
export async function updateIdentity(identity: CreativeIdentity): Promise<CreativeIdentity> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  const existing = await getIdentity(identity.id);
  if (!existing) {
    throw new CreativeIdentityError('NOT_FOUND', `Identity ${identity.id} not found`);
  }

  identity.version = existing.version + 1;
  identity.updatedAt = now;

  const row = domainToRow(identity);

  // Deactivate old versions, then update current
  try {
    await db.prepare(`UPDATE creative_identities SET is_active = 0 WHERE workspace_id = ?1 AND id != ?2`).bind(row.workspace_id, row.id).run();

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
  } catch (err) {
    throw new CreativeIdentityError('UPDATE_FAILED', `Failed to update identity: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return identity;
}

/**
 * Soft-delete (deactivate) an identity.
 */
export async function deactivateIdentity(id: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new CreativeIdentityError('D1_UNAVAILABLE', 'D1 not available');

  await db.prepare(`UPDATE creative_identities SET is_active = 0 WHERE id = ?1`).bind(id).run();
}