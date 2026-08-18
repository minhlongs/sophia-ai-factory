/**
 * D1 query helpers for ad network credential storage.
 * @module land/adsense/db-helpers
 */

interface D1Row {
  encrypted_credentials: string;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export async function validateMembership(
  db: D1Database,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return row !== null;
}

export async function fetchEncrypted(
  db: D1Database,
  tenantId: string,
  network: string,
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT encrypted_credentials FROM affiliate_network_credentials
       WHERE tenant_id = ? AND network = ?`,
    )
    .bind(tenantId, network)
    .first<Pick<D1Row, 'encrypted_credentials'>>();
  return row ? row.encrypted_credentials : null;
}

export async function upsertEncrypted(
  db: D1Database,
  tenantId: string,
  network: string,
  encrypted: string,
): Promise<void> {
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

export async function deleteByNetwork(
  db: D1Database,
  tenantId: string,
  network: string,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM affiliate_network_credentials
       WHERE tenant_id = ? AND network = ?`,
    )
    .bind(tenantId, network)
    .run();
}

export async function listNetworks(
  db: D1Database,
  tenantId: string,
): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT network FROM affiliate_network_credentials WHERE tenant_id = ?`,
    )
    .bind(tenantId)
    .all<{ network: string }>();
  return rows.results.map((r) => r.network);
}