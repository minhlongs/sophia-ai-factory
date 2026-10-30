/**
 * Tenant + secret resolution for legacy affiliate webhook endpoints.
 *
 * Legacy provider URLs predate workspace-scoped credentials: they verified with
 * one global env secret and recorded under a global tenant fallback. This module
 * rebinds them per request:
 *
 *   1. Extract sub-id/link candidates from the (still unverified) payload plus
 *      an explicit tenant hint. Parsing before verification is safe: nothing is
 *      trusted until the HMAC check passes.
 *   2. Look the candidate up in tracking_links (new tracker), then
 *      affiliate_links by sub_id (legacy tracker) to find the owning workspace.
 *   3. Load that workspace's stored credential for the network and pick the
 *      signing-secret field.
 *
 * The caller MUST verify the provider signature against the returned secret.
 * An explicit tenant hint is only trustworthy after that check passes.
 *
 * There is deliberately NO global-secret fallback and NO default-tenant fallback:
 * unresolvable requests fail closed with an actionable error.
 *
 * Layer: land/postback (Business Workflow)
 * @module land/postback/legacy-tenant-resolver
 */

import { getCredentials, type AffiliateNetwork } from '@/land/affiliates/credentials';
import { pickCredentialSecret } from './network-secret-resolver';

export const LEGACY_MIGRATION_GUIDANCE =
  'Legacy global webhook secrets are no longer accepted. Store this network ' +
  'credential in the workspace (BYOK credentials) and either keep this URL ' +
  'with a workspace tracking sub-id, or move to /api/postback/{network}. ' +
  'See docs/postback-tenant-migration.md (VI/EN).';

export interface LegacyLinkHit {
  linkId: string;
  tenantId: string;
}

export type LegacyTenantResolution =
  | { ok: true; tenantId: string; linkId: string | null; secret: string }
  | { ok: false; error: 'tenant_unresolvable' }
  | { ok: false; error: 'secret_not_configured'; tenantId: string };

export interface ResolveLegacyTenantInput {
  db: D1Database;
  /** Credential-store network value (e.g. 'amazon', 'partnerstack'). */
  dbNetwork: string;
  /** Sub-id/link candidates extracted from the payload (unverified hints). */
  subIdCandidates: readonly (string | null | undefined)[];
  /** Explicit tenant hint from body/query (unverified until signature passes). */
  explicitTenantId: string | null;
}

async function findLinkTenant(
  db: D1Database,
  candidate: string,
): Promise<LegacyLinkHit | null> {
  const tracking = await db
    .prepare('SELECT id, tenant_id FROM tracking_links WHERE id = ? LIMIT 1')
    .bind(candidate)
    .first<{ id: string; tenant_id: string }>();
  if (tracking) return { linkId: tracking.id, tenantId: tracking.tenant_id };

  const legacy = await db
    .prepare('SELECT id, tenant_id FROM affiliate_links WHERE sub_id = ? LIMIT 1')
    .bind(candidate)
    .first<{ id: string; tenant_id: string }>();
  if (legacy) return { linkId: legacy.id, tenantId: legacy.tenant_id };

  return null;
}

/**
 * Resolve the workspace + signing secret for one legacy webhook request.
 * Returns a fail-closed error when no workspace can be determined or when the
 * workspace has no stored credential for the network.
 */
export async function resolveLegacyTenantSecret(
  input: ResolveLegacyTenantInput,
): Promise<LegacyTenantResolution> {
  const { db, dbNetwork, subIdCandidates, explicitTenantId } = input;

  let hit: LegacyLinkHit | null = null;
  for (const raw of subIdCandidates) {
    if (typeof raw !== 'string' || raw.trim().length === 0) continue;
    hit = await findLinkTenant(db, raw.trim());
    if (hit) break;
  }

  const tenantId = hit?.tenantId ?? explicitTenantId;
  if (!tenantId) return { ok: false, error: 'tenant_unresolvable' };

  const creds = await getCredentials(db, tenantId, dbNetwork as AffiliateNetwork);
  const secret = creds ? pickCredentialSecret(dbNetwork, creds) : null;
  if (!secret) return { ok: false, error: 'secret_not_configured', tenantId };

  return { ok: true, tenantId, linkId: hit?.linkId ?? null, secret };
}
