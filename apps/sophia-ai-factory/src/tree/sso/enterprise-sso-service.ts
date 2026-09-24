/**
 * Enterprise Multi-Org SAML/OIDC SSO Service
 *
 * Implements corporate domain resolution, IdP routing, and configuration lifecycle
 * for enterprise organizations.
 *
 * Layer: tree (Domain logic and repositories)
 * Allowed imports: @/seed/*, standard libraries
 *
 * @module tree/sso/enterprise-sso-service
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EnterpriseSsoConfig,
  EnterpriseSsoRow,
  CreateEnterpriseSsoInput,
  UpdateEnterpriseSsoInput,
  IdpRoutingMetadata,
} from '@/seed/types/enterprise-sso';
import { logger } from '@/seed/utils/logger-utility';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// ── Public Email Providers Blocklist ──────────────────────────────────────────

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.fr',
  'yahoo.co.jp',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'yandex.com',
  'yandex.ru',
  'fastmail.com',
  'tutanota.com',
  'tuta.com',
]);

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

// ── Corporate Domain Utilities ────────────────────────────────────────────────

/**
 * Normalizes a corporate domain string or email.
 * Strips leading '@', protocols, paths, converts to lowercase.
 *
 * @example
 * normalizeCorporateDomain("alice@AcmeCorp.COM") // "acmecorp.com"
 * normalizeCorporateDomain("@AcmeCorp.COM")      // "acmecorp.com"
 * normalizeCorporateDomain("https://acme.com/")  // "acme.com"
 */
export function normalizeCorporateDomain(domainOrEmail: string): string {
  if (!domainOrEmail || typeof domainOrEmail !== 'string') {
    return '';
  }

  let cleaned = domainOrEmail.trim().toLowerCase();

  // Strip protocol if present
  if (cleaned.startsWith('https://')) cleaned = cleaned.slice(8);
  if (cleaned.startsWith('http://')) cleaned = cleaned.slice(7);

  // Strip path or port if present
  const slashIdx = cleaned.indexOf('/');
  if (slashIdx !== -1) cleaned = cleaned.slice(0, slashIdx);

  const colonIdx = cleaned.indexOf(':');
  if (colonIdx !== -1) cleaned = cleaned.slice(0, colonIdx);

  // Extract domain from email
  const atIdx = cleaned.lastIndexOf('@');
  if (atIdx !== -1) {
    cleaned = cleaned.slice(atIdx + 1);
  }

  // Remove leading dot or trailing dot
  cleaned = cleaned.replace(/^\.+|\.+$/g, '');

  return cleaned;
}

/**
 * Validates whether a domain is an enterprise corporate domain.
 * Must match FQDN rules and not belong to a public consumer email provider.
 */
export function isCorporateEmailDomain(domainOrEmail: string): boolean {
  const domain = normalizeCorporateDomain(domainOrEmail);
  if (!domain || domain.length < 4 || domain.length > 253) {
    return false;
  }

  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return false;
  }

  if (!DOMAIN_REGEX.test(domain)) {
    return false;
  }

  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (tld.length < 2 || !/^[a-z]+$/i.test(tld)) {
    return false;
  }

  return true;
}

// ── Encryption for Client Secrets (AES-256-GCM) ──────────────────────────────

function getEncryptionKey(): Buffer {
  const secret =
    process.env.SSO_SECRET_ENCRYPTION_KEY ||
    process.env.CREDENTIALS_MASTER_KEY ||
    'sophia_sso_default_fallback_master_encryption_key_2026';
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypt client secret using AES-256-GCM
 */
export function encryptClientSecret(secret: string): string {
  if (!secret) return '';
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: "aes-gcm:<iv_base64>:<tag_base64>:<data_base64>"
  return `aes-gcm:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt client secret using AES-256-GCM
 */
export function decryptClientSecret(encryptedPayload: string | null | undefined): string | null {
  if (!encryptedPayload) return null;
  if (!encryptedPayload.startsWith('aes-gcm:')) {
    // Unencrypted or legacy format
    return encryptedPayload;
  }

  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 4) return null;

    const iv = Buffer.from(parts[1], 'base64');
    const authTag = Buffer.from(parts[2], 'base64');
    const encrypted = Buffer.from(parts[3], 'base64');

    const key = getEncryptionKey();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    logger.warn('[enterprise-sso-service] Decryption failed for client secret', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Mapping Helper ────────────────────────────────────────────────────────────

function mapRowToConfig(row: EnterpriseSsoRow): EnterpriseSsoConfig {
  return {
    id: row.id,
    orgId: row.org_id,
    domain: row.domain,
    providerType: row.provider_type as 'saml' | 'oidc',
    issuer: row.issuer,
    clientId: row.client_id,
    clientSecretEncrypted: row.client_secret_encrypted,
    metadataUrl: row.metadata_url,
    ssoUrl: row.sso_url,
    certificate: row.certificate,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Repository Functions ──────────────────────────────────────────────────────

/**
 * Retrieve an active Enterprise SSO configuration by email domain.
 */
export async function getEnterpriseSsoByDomain(
  db: D1Database,
  domainOrEmail: string,
): Promise<EnterpriseSsoConfig | null> {
  const domain = normalizeCorporateDomain(domainOrEmail);
  if (!domain) return null;

  try {
    const row = await db
      .prepare(
        `SELECT id, org_id, domain, provider_type, issuer, client_id, client_secret_encrypted,
                metadata_url, sso_url, certificate, enabled, created_at, updated_at
         FROM enterprise_sso_configs
         WHERE domain = ?1 AND enabled = 1
         LIMIT 1`,
      )
      .bind(domain)
      .first<EnterpriseSsoRow>();

    return row ? mapRowToConfig(row) : null;
  } catch (err) {
    logger.error('[enterprise-sso-service] Failed to get SSO config by domain', {
      domain,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * List all SSO configurations for a specific organization.
 */
export async function getEnterpriseSsoByOrg(
  db: D1Database,
  orgId: string,
): Promise<EnterpriseSsoConfig[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT id, org_id, domain, provider_type, issuer, client_id, client_secret_encrypted,
                metadata_url, sso_url, certificate, enabled, created_at, updated_at
         FROM enterprise_sso_configs
         WHERE org_id = ?1
         ORDER BY created_at DESC`,
      )
      .bind(orgId)
      .all<EnterpriseSsoRow>();

    return (results || []).map(mapRowToConfig);
  } catch (err) {
    logger.error('[enterprise-sso-service] Failed to list SSO configs by org', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Retrieve a single SSO configuration by ID.
 */
export async function getEnterpriseSsoById(
  db: D1Database,
  id: string,
): Promise<EnterpriseSsoConfig | null> {
  try {
    const row = await db
      .prepare(
        `SELECT id, org_id, domain, provider_type, issuer, client_id, client_secret_encrypted,
                metadata_url, sso_url, certificate, enabled, created_at, updated_at
         FROM enterprise_sso_configs
         WHERE id = ?1
         LIMIT 1`,
      )
      .bind(id)
      .first<EnterpriseSsoRow>();

    return row ? mapRowToConfig(row) : null;
  } catch (err) {
    logger.error('[enterprise-sso-service] Failed to get SSO config by id', {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Create or save an Enterprise SSO configuration.
 */
export async function saveEnterpriseSsoConfig(
  db: D1Database,
  input: CreateEnterpriseSsoInput,
): Promise<EnterpriseSsoConfig> {
  const normalizedDomain = normalizeCorporateDomain(input.domain);

  if (!isCorporateEmailDomain(normalizedDomain)) {
    throw new Error(
      `Invalid corporate email domain: "${input.domain}". Must be a valid corporate domain (not public webmail like gmail.com).`,
    );
  }

  // Check if domain is already registered by another organization
  const existingDomainConfig = await db
    .prepare('SELECT id, org_id FROM enterprise_sso_configs WHERE domain = ?1 LIMIT 1')
    .bind(normalizedDomain)
    .first<{ id: string; org_id: string }>();

  if (existingDomainConfig && existingDomainConfig.org_id !== input.orgId) {
    throw new Error(
      `Domain "${normalizedDomain}" is already claimed by another organization. Contact support for domain verification.`,
    );
  }

  const id = existingDomainConfig ? existingDomainConfig.id : randomBytes(16).toString('hex');
  const encryptedSecret = input.clientSecret ? encryptClientSecret(input.clientSecret) : null;
  const enabledInt = input.enabled !== false ? 1 : 0;
  const now = Math.floor(Date.now() / 1000);

  if (existingDomainConfig) {
    await db
      .prepare(
        `UPDATE enterprise_sso_configs
         SET provider_type = ?1,
             issuer = ?2,
             client_id = ?3,
             client_secret_encrypted = COALESCE(?4, client_secret_encrypted),
             metadata_url = ?5,
             sso_url = ?6,
             certificate = ?7,
             enabled = ?8,
             updated_at = ?9
         WHERE id = ?10`,
      )
      .bind(
        input.providerType,
        input.issuer,
        input.clientId,
        encryptedSecret,
        input.metadataUrl ?? null,
        input.ssoUrl ?? null,
        input.certificate ?? null,
        enabledInt,
        now,
        id,
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO enterprise_sso_configs (
          id, org_id, domain, provider_type, issuer, client_id,
          client_secret_encrypted, metadata_url, sso_url, certificate,
          enabled, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
      )
      .bind(
        id,
        input.orgId,
        normalizedDomain,
        input.providerType,
        input.issuer,
        input.clientId,
        encryptedSecret,
        input.metadataUrl ?? null,
        input.ssoUrl ?? null,
        input.certificate ?? null,
        enabledInt,
        now,
        now,
      )
      .run();
  }

  const saved = await getEnterpriseSsoById(db, id);
  if (!saved) {
    throw new Error('Failed to retrieve saved SSO config after insertion');
  }

  return saved;
}

/**
 * Update an existing SSO configuration.
 */
export async function updateEnterpriseSsoConfig(
  db: D1Database,
  id: string,
  orgId: string,
  input: UpdateEnterpriseSsoInput,
): Promise<EnterpriseSsoConfig | null> {
  const existing = await getEnterpriseSsoById(db, id);
  if (!existing || existing.orgId !== orgId) {
    return null;
  }

  let domain = existing.domain;
  if (input.domain) {
    const normalized = normalizeCorporateDomain(input.domain);
    if (!isCorporateEmailDomain(normalized)) {
      throw new Error(`Invalid corporate email domain: "${input.domain}"`);
    }

    // Check conflict
    const conflict = await db
      .prepare('SELECT id FROM enterprise_sso_configs WHERE domain = ?1 AND id != ?2 LIMIT 1')
      .bind(normalized, id)
      .first<{ id: string }>();

    if (conflict) {
      throw new Error(`Domain "${normalized}" is already registered to another SSO config.`);
    }

    domain = normalized;
  }

  const providerType = input.providerType ?? existing.providerType;
  const issuer = input.issuer ?? existing.issuer;
  const clientId = input.clientId ?? existing.clientId;
  const encryptedSecret = input.clientSecret
    ? encryptClientSecret(input.clientSecret)
    : existing.clientSecretEncrypted;
  const metadataUrl = input.metadataUrl !== undefined ? input.metadataUrl : existing.metadataUrl;
  const ssoUrl = input.ssoUrl !== undefined ? input.ssoUrl : existing.ssoUrl;
  const certificate = input.certificate !== undefined ? input.certificate : existing.certificate;
  const enabledInt = input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled ? 1 : 0;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `UPDATE enterprise_sso_configs
       SET domain = ?1,
           provider_type = ?2,
           issuer = ?3,
           client_id = ?4,
           client_secret_encrypted = ?5,
           metadata_url = ?6,
           sso_url = ?7,
           certificate = ?8,
           enabled = ?9,
           updated_at = ?10
       WHERE id = ?11 AND org_id = ?12`,
    )
    .bind(
      domain,
      providerType,
      issuer,
      clientId,
      encryptedSecret,
      metadataUrl,
      ssoUrl,
      certificate,
      enabledInt,
      now,
      id,
      orgId,
    )
    .run();

  return getEnterpriseSsoById(db, id);
}

/**
 * Delete an SSO configuration.
 */
export async function deleteEnterpriseSsoConfig(
  db: D1Database,
  id: string,
  orgId: string,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM enterprise_sso_configs WHERE id = ?1 AND org_id = ?2')
    .bind(id, orgId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

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
