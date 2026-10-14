/**
 * D1 SQL Statement Execution Helpers for Enterprise SSO Config Manager.
 * @module tree/sso/service/sso-config-statements
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { CreateEnterpriseSsoInput } from '@/seed/types/enterprise-sso';

export async function upsertEnterpriseSsoRow(params: {
  db: D1Database;
  id: string;
  isUpdate: boolean;
  normalizedDomain: string;
  input: CreateEnterpriseSsoInput;
  encryptedSecret: string | null;
  enabledInt: number;
  now: number;
}): Promise<void> {
  const { db, id, isUpdate, normalizedDomain, input, encryptedSecret, enabledInt, now } = params;

  if (isUpdate) {
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
}
