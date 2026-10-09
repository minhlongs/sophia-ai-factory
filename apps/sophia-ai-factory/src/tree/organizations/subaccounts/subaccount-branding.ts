/**
 * Subaccount Whitelabel Branding Management
 *
 * Layer: tree/organizations (Pure domain logic - only imports from @/seed)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module tree/organizations/subaccounts/subaccount-branding
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SubaccountBranding,
  UpdateBrandingInput,
} from '@/seed/types/agency-multitenancy';

interface BrandingRow {
  subaccount_id: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Retrieves branding details for a subaccount.
 */
export async function getSubaccountBranding(
  db: D1Database,
  subaccountId: string
): Promise<SubaccountBranding | null> {
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
