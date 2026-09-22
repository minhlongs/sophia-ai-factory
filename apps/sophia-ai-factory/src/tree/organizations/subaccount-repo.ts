/**
 * Agency Client Sub-Account Repository & Brand Customization Service
 *
 * Implements:
 * - Subaccount CRUD, domain lookup, status lifecycle
 * - Whitelabel client branding management (logo, primary, accent colors)
 * - Subaccount-scoped RBAC member management (Agency Owner, Video Editor, Client Reviewer)
 *
 * Layer: tree/organizations (Pure domain logic - only imports from @/seed)
 *
 * @module tree/organizations/subaccount-repo
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ClientSubaccount,
  CreateSubaccountInput,
  UpdateSubaccountInput,
  SubaccountBranding,
  UpdateBrandingInput,
  SubaccountMember,
  SubaccountRole,
} from '@/seed/types/agency-multitenancy';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'subaccount';
}

interface SubaccountRow {
  id: string;
  agency_org_id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  allocated_mcu?: number | null;
  used_mcu?: number | null;
}

function mapRowToSubaccount(row: SubaccountRow): ClientSubaccount {
  const allocated = Number(row.allocated_mcu ?? 0);
  const used = Number(row.used_mcu ?? 0);
  const remaining = Math.max(0, allocated - used);
  const isSuspended = row.status?.toLowerCase() === 'suspended' || row.status?.toLowerCase() === 'archived';

  return {
    id: row.id,
    agencyOrgId: row.agency_org_id,
    name: row.name,
    slug: row.slug,
    customDomain: row.custom_domain ?? undefined,
    branding: {
      logoUrl: row.logo_url ?? undefined,
      primaryColor: row.primary_color ?? '#0f172a',
      accentColor: row.accent_color ?? '#10b981',
    },
    mcuQuota: {
      allocated,
      used,
      remaining,
    },
    status: isSuspended ? 'SUSPENDED' : 'ACTIVE',
  };
}

const BASE_SELECT = `
  SELECT 
    cs.id, cs.agency_org_id, cs.name, cs.slug, cs.custom_domain, cs.status, cs.created_at, cs.updated_at,
    sb.logo_url, sb.primary_color, sb.accent_color,
    sma.allocated_mcu, sma.used_mcu
  FROM client_subaccounts cs
  LEFT JOIN subaccount_branding sb ON cs.id = sb.subaccount_id
  LEFT JOIN subaccount_mcu_allocations sma ON cs.id = sma.subaccount_id
`;

/**
 * Creates a new client subaccount within an agency organization.
 */
export async function createSubaccount(
  db: D1Database,
  input: CreateSubaccountInput
): Promise<ClientSubaccount> {
  const agencyOrgId = input.agencyOrgId?.trim();
  const name = input.name?.trim();

  if (!agencyOrgId) {
    throw new Error('VALIDATION_ERROR: agencyOrgId is required');
  }
  if (!name) {
    throw new Error('VALIDATION_ERROR: Subaccount name is required');
  }

  const slug = (input.slug?.trim() || slugify(name)).toLowerCase();

  // Check for slug uniqueness within the agency organization
  const existing = await db
    .prepare('SELECT id FROM client_subaccounts WHERE agency_org_id = ? AND slug = ?')
    .bind(agencyOrgId, slug)
    .first<{ id: string }>();

  if (existing) {
    throw new Error(`SUBACCOUNT_SLUG_CONFLICT: Subaccount slug '${slug}' already exists for this agency`);
  }

  const id = `sub_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();
  const customDomain = input.customDomain?.trim() ? input.customDomain.trim().toLowerCase() : null;

  await db
    .prepare(`
      INSERT INTO client_subaccounts (id, agency_org_id, name, slug, custom_domain, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `)
    .bind(id, agencyOrgId, name, slug, customDomain, now, now)
    .run();

  if (input.branding) {
    await db
      .prepare(`
        INSERT INTO subaccount_branding (subaccount_id, logo_url, primary_color, accent_color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        input.branding.logoUrl ?? null,
        input.branding.primaryColor ?? '#0f172a',
        input.branding.accentColor ?? '#10b981',
        now,
        now
      )
      .run();
  }

  if (typeof input.initialMcu === 'number' && input.initialMcu >= 0) {
    const allocId = `mcu_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await db
      .prepare(`
        INSERT INTO subaccount_mcu_allocations (id, subaccount_id, allocated_mcu, used_mcu, created_at, updated_at)
        VALUES (?, ?, ?, 0, ?, ?)
      `)
      .bind(allocId, id, input.initialMcu, now, now)
      .run();
  }

  const created = await getSubaccountById(db, id);
  if (!created) {
    throw new Error('INTERNAL_ERROR: Failed to retrieve newly created subaccount');
  }
  return created;
}

/**
 * Retrieves a client subaccount by its ID with full branding and MCU quota.
 */
export async function getSubaccountById(
  db: D1Database,
  subaccountId: string
): Promise<ClientSubaccount | null> {
  const row = await db
    .prepare(`${BASE_SELECT} WHERE cs.id = ?`)
    .bind(subaccountId)
    .first<SubaccountRow>();

  if (!row) return null;
  return mapRowToSubaccount(row);
}

/**
 * Retrieves a client subaccount by slug within an agency organization.
 */
export async function getSubaccountBySlug(
  db: D1Database,
  agencyOrgId: string,
  slug: string
): Promise<ClientSubaccount | null> {
  const row = await db
    .prepare(`${BASE_SELECT} WHERE cs.agency_org_id = ? AND cs.slug = ?`)
    .bind(agencyOrgId, slug.toLowerCase())
    .first<SubaccountRow>();

  if (!row) return null;
  return mapRowToSubaccount(row);
}

/**
 * Lists all client subaccounts belonging to an agency organization.
 */
export async function listSubaccountsByOrg(
  db: D1Database,
  agencyOrgId: string
): Promise<ClientSubaccount[]> {
  const { results } = await db
    .prepare(`${BASE_SELECT} WHERE cs.agency_org_id = ? ORDER BY cs.created_at DESC`)
    .bind(agencyOrgId)
    .all<SubaccountRow>();

  return (results || []).map(mapRowToSubaccount);
}

/**
 * Updates an existing subaccount's details (name, slug, custom domain, status).
 */
export async function updateSubaccount(
  db: D1Database,
  subaccountId: string,
  input: UpdateSubaccountInput
): Promise<ClientSubaccount> {
  const existing = await getSubaccountById(db, subaccountId);
  if (!existing) {
    throw new Error(`SUBACCOUNT_NOT_FOUND: Subaccount '${subaccountId}' does not exist`);
  }

  const updates: string[] = [];
  const bindings: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    bindings.push(input.name.trim());
  }
  if (input.slug !== undefined) {
    const nextSlug = input.slug.trim().toLowerCase();
    const conflict = await db
      .prepare('SELECT id FROM client_subaccounts WHERE agency_org_id = ? AND slug = ? AND id != ?')
      .bind(existing.agencyOrgId, nextSlug, subaccountId)
      .first<{ id: string }>();

    if (conflict) {
      throw new Error(`SUBACCOUNT_SLUG_CONFLICT: Slug '${nextSlug}' is already taken`);
    }
    updates.push('slug = ?');
    bindings.push(nextSlug);
  }
  if (input.customDomain !== undefined) {
    updates.push('custom_domain = ?');
    bindings.push(input.customDomain ? input.customDomain.trim().toLowerCase() : null);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    bindings.push(input.status.toLowerCase());
  }

  if (updates.length > 0) {
    const now = new Date().toISOString();
    updates.push('updated_at = ?');
    bindings.push(now);
    bindings.push(subaccountId);

    await db
      .prepare(`UPDATE client_subaccounts SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();
  }

  const updated = await getSubaccountById(db, subaccountId);
  if (!updated) {
    throw new Error('INTERNAL_ERROR: Failed to retrieve updated subaccount');
  }
  return updated;
}

/**
 * Archives/suspends a client subaccount.
 */
export async function archiveSubaccount(
  db: D1Database,
  subaccountId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare("UPDATE client_subaccounts SET status = 'suspended', updated_at = ? WHERE id = ?")
    .bind(now, subaccountId)
    .run();
}

/**
 * Resolves a client subaccount by custom domain hostname.
 */
export async function getSubaccountByCustomDomain(
  db: D1Database,
  hostname: string
): Promise<ClientSubaccount | null> {
  const normalized = hostname.trim().toLowerCase();
  const row = await db
    .prepare(`${BASE_SELECT} WHERE LOWER(cs.custom_domain) = ? AND cs.status = 'active'`)
    .bind(normalized)
    .first<SubaccountRow>();

  if (!row) return null;
  return mapRowToSubaccount(row);
}

/**
 * Retrieves branding details for a subaccount.
 */
export async function getSubaccountBranding(
  db: D1Database,
  subaccountId: string
): Promise<SubaccountBranding | null> {
  interface BrandingRow {
    subaccount_id: string;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    created_at: string;
    updated_at: string;
  }

  const row = await db
    .prepare('SELECT * FROM subaccount_branding WHERE subaccount_id = ?')
    .bind(subaccountId)
    .first<BrandingRow>();

  if (!row) return null;
  return {
    subaccountId: row.subaccount_id,
    logoUrl: row.logo_url ?? undefined,
    primaryColor: row.primary_color ?? '#0f172a',
    accentColor: row.accent_color ?? '#10b981',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Upserts client branding (logo, primary color, accent color) for a subaccount.
 */
export async function upsertSubaccountBranding(
  db: D1Database,
  subaccountId: string,
  input: UpdateBrandingInput
): Promise<SubaccountBranding> {
  const now = new Date().toISOString();
  const existing = await getSubaccountBranding(db, subaccountId);

  const logoUrl = input.logoUrl !== undefined ? input.logoUrl : existing?.logoUrl ?? null;
  const primaryColor = input.primaryColor !== undefined ? input.primaryColor : existing?.primaryColor ?? '#0f172a';
  const accentColor = input.accentColor !== undefined ? input.accentColor : existing?.accentColor ?? '#10b981';

  await db
    .prepare(`
      INSERT INTO subaccount_branding (subaccount_id, logo_url, primary_color, accent_color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(subaccount_id) DO UPDATE SET
        logo_url = excluded.logo_url,
        primary_color = excluded.primary_color,
        accent_color = excluded.accent_color,
        updated_at = excluded.updated_at
    `)
    .bind(subaccountId, logoUrl, primaryColor, accentColor, now, now)
    .run();

  return {
    subaccountId,
    logoUrl: logoUrl ?? undefined,
    primaryColor,
    accentColor,
    updatedAt: now,
  };
}

/**
 * Adds or updates a user's role within a subaccount.
 */
export async function addSubaccountMember(
  db: D1Database,
  subaccountId: string,
  userId: string,
  role: SubaccountRole
): Promise<SubaccountMember> {
  const normalizedRole = role.toLowerCase() as SubaccountRole;
  const now = new Date().toISOString();
  const id = `sm_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  await db
    .prepare(`
      INSERT INTO subaccount_members (id, subaccount_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(subaccount_id, user_id) DO UPDATE SET
        role = excluded.role
    `)
    .bind(id, subaccountId, userId, normalizedRole, now)
    .run();

  return {
    id,
    subaccountId,
    userId,
    role: normalizedRole,
    createdAt: now,
  };
}

/**
 * Retrieves a user's role in a specific subaccount.
 */
export async function getSubaccountMember(
  db: D1Database,
  subaccountId: string,
  userId: string
): Promise<SubaccountMember | null> {
  interface MemberRow {
    id: string;
    subaccount_id: string;
    user_id: string;
    role: string;
    created_at: string;
  }

  const row = await db
    .prepare('SELECT * FROM subaccount_members WHERE subaccount_id = ? AND user_id = ?')
    .bind(subaccountId, userId)
    .first<MemberRow>();

  if (!row) return null;
  return {
    id: row.id,
    subaccountId: row.subaccount_id,
    userId: row.user_id,
    role: row.role as SubaccountRole,
    createdAt: row.created_at,
  };
}

/**
 * Lists all members assigned to a client subaccount.
 */
export async function listSubaccountMembers(
  db: D1Database,
  subaccountId: string
): Promise<SubaccountMember[]> {
  interface MemberRow {
    id: string;
    subaccount_id: string;
    user_id: string;
    role: string;
    created_at: string;
  }

  const { results } = await db
    .prepare('SELECT * FROM subaccount_members WHERE subaccount_id = ? ORDER BY created_at ASC')
    .bind(subaccountId)
    .all<MemberRow>();

  return (results || []).map((row) => ({
    id: row.id,
    subaccountId: row.subaccount_id,
    userId: row.user_id,
    role: row.role as SubaccountRole,
    createdAt: row.created_at,
  }));
}

/**
 * Removes a member from a client subaccount.
 */
export async function removeSubaccountMember(
  db: D1Database,
  subaccountId: string,
  userId: string
): Promise<void> {
  await db
    .prepare('DELETE FROM subaccount_members WHERE subaccount_id = ? AND user_id = ?')
    .bind(subaccountId, userId)
    .run();
}
