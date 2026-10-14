import { encryptToken, decryptToken } from '@/tree/crypto/token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import {
  AffiliateNetwork,
  NetworkCredentialPayload,
  CredentialRow,
  D1CredentialRow,
  generateId,
} from './types';

export async function saveCredentials<N extends AffiliateNetwork>(
  db: D1Database,
  tenantId: string,
  network: N,
  payload: NetworkCredentialPayload[N],
): Promise<void> {
  const json = JSON.stringify(payload);
  const encrypted = await encryptToken(json);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO affiliate_network_credentials
         (id, tenant_id, network, encrypted_credentials, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)
       ON CONFLICT(tenant_id, network) DO UPDATE SET
         encrypted_credentials = excluded.encrypted_credentials,
         status = 'active',
         updated_at = excluded.updated_at`,
    )
    .bind(generateId(), tenantId, network, encrypted, now, now)
    .run();
}

export async function getCredentials<N extends AffiliateNetwork>(
  db: D1Database,
  tenantId: string,
  network: N,
): Promise<NetworkCredentialPayload[N] | null> {
  const row = await db
    .prepare(
      `SELECT encrypted_credentials FROM affiliate_network_credentials
       WHERE tenant_id = ? AND network = ?`,
    )
    .bind(tenantId, network)
    .first<Pick<D1CredentialRow, 'encrypted_credentials'>>();

  if (!row) return null;

  try {
    const json = await decryptToken(row.encrypted_credentials);
    return JSON.parse(json) as NetworkCredentialPayload[N];
  } catch (err) {
    logger.error('[affiliate-credentials] Decrypt failed', err instanceof Error ? err : undefined);
    return null;
  }
}

export async function deleteCredentials(
  db: D1Database,
  tenantId: string,
  network: AffiliateNetwork,
): Promise<void> {
  await db
    .prepare(`DELETE FROM affiliate_network_credentials WHERE tenant_id = ? AND network = ?`)
    .bind(tenantId, network)
    .run();
}

export async function listNetworks(
  db: D1Database,
  tenantId: string,
): Promise<CredentialRow[]> {
  const { results } = await db
    .prepare(
      `SELECT network, status, last_validated_at
       FROM affiliate_network_credentials
       WHERE tenant_id = ?
       ORDER BY network`,
    )
    .bind(tenantId)
    .all<CredentialRow>();

  return results ?? [];
}
