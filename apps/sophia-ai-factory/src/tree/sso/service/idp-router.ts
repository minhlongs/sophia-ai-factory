/**
 * @file idp-router.ts
 * @description IdP routing resolution for enterprise corporate login redirects.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { IdpRoutingMetadata } from '@/seed/types/enterprise-sso';
import { normalizeCorporateDomain } from './domain-validator';
import { getEnterpriseSsoByDomain } from './sso-repository';

/**
 * Resolves IdP routing metadata for a given user email.
 * Used during login flow to redirect users to their corporate SAML/OIDC IdP.
 */
export async function resolveIdpRouting(
  db: D1Database,
  email: string,
): Promise<IdpRoutingMetadata | null> {
  const domain = normalizeCorporateDomain(email);
  if (!domain) return null;

  const config = await getEnterpriseSsoByDomain(db, domain);
  if (!config || !config.enabled) return null;

  let orgName: string | undefined;
  try {
    const org = await db
      .prepare('SELECT name FROM organizations WHERE id = ?1 LIMIT 1')
      .bind(config.orgId)
      .first<{ name: string }>();
    if (org?.name) {
      orgName = org.name;
    }
  } catch {
    // Non-fatal if organization name lookup fails
  }

  // Construct target SSO URL if not explicitly saved
  const ssoUrl =
    config.ssoUrl ||
    (config.providerType === 'saml'
      ? `${config.issuer}/saml2/idp/SSOService.php`
      : `${config.issuer}/oauth2/v1/authorize`);

  return {
    domain: config.domain,
    providerType: config.providerType,
    issuer: config.issuer,
    ssoUrl,
    orgId: config.orgId,
    orgName,
  };
}
