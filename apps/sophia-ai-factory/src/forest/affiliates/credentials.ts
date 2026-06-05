/**
 * Per-tenant affiliate network credential storage.
 * Encrypts credentials via AES-256-GCM (same key as publishing token-crypto).
 * All reads/writes are scoped to a single tenant_id.
 * @module lib/affiliates/credentials
 */

import { encryptToken, decryptToken } from '@/forest/publishing/token-crypto';
import { logger } from '@/seed/utils/logger-utility';

/** All supported affiliate/exchange networks */
export type AffiliateNetwork =
  | 'impact_radius'
  | 'partnerstack'
  | 'cj'
  | 'shareasale'
  | 'clickbank'
  | 'binance'
  | 'bybit'
  | 'bitget'
  | 'coinbase';

/** Credential payload shape per network */
export interface NetworkCredentialPayload {
  impact_radius: { client_id: string; client_secret: string };
  partnerstack: { api_key: string };
  cj: { api_key: string; website_id?: string };
  shareasale: { api_token: string; affiliate_id: string };
  clickbank: { api_key: string; clerk_key: string };
  binance: { api_key: string; api_secret: string };
  bybit: { api_key: string; api_secret: string };
  bitget: { api_key: string; api_secret: string; passphrase: string };
  coinbase: { api_key: string; api_secret: string };
}

export interface CredentialRow {
  network: AffiliateNetwork;
  status: 'active' | 'invalid' | 'rate_limited';
  last_validated_at: string | null;
}

/** D1 row shape */
interface D1Row {
  id: string;
  tenant_id: string;
  network: AffiliateNetwork;
  encrypted_credentials: string;
  status: 'active' | 'invalid' | 'rate_limited';
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Upsert credentials for a tenant+network.
 * Payload is JSON-serialised then AES-256-GCM encrypted.
 */
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

/**
 * Retrieve and decrypt stored credentials. Returns null if not found.
 */
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
    .first<Pick<D1Row, 'encrypted_credentials'>>();

  if (!row) return null;

  try {
    const json = await decryptToken(row.encrypted_credentials);
    return JSON.parse(json) as NetworkCredentialPayload[N];
  } catch (err) {
    logger.error('[affiliate-credentials] Decrypt failed', err instanceof Error ? err : undefined);
    return null;
  }
}

/** Delete credentials for a tenant+network. No-op if not found. */
export async function deleteCredentials(
  db: D1Database,
  tenantId: string,
  network: AffiliateNetwork,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM affiliate_network_credentials WHERE tenant_id = ? AND network = ?`,
    )
    .bind(tenantId, network)
    .run();
}

/** List all networks configured for a tenant (no decryption). */
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

/** Update the status column after a validation attempt. */
async function setValidationStatus(
  db: D1Database,
  tenantId: string,
  network: AffiliateNetwork,
  status: 'active' | 'invalid' | 'rate_limited',
): Promise<void> {
  await db
    .prepare(
      `UPDATE affiliate_network_credentials
       SET status = ?, last_validated_at = ?, updated_at = ?
       WHERE tenant_id = ? AND network = ?`,
    )
    .bind(status, new Date().toISOString(), new Date().toISOString(), tenantId, network)
    .run();
}

/**
 * Validate stored credentials by making a lightweight API probe.
 * Updates status in DB. Returns {valid, error?}.
 */
export async function validateCredentials(
  db: D1Database,
  tenantId: string,
  network: AffiliateNetwork,
): Promise<{ valid: boolean; error?: string }> {
  const payload = await getCredentials(db, tenantId, network);
  if (!payload) {
    return { valid: false, error: 'No credentials stored for this network' };
  }

  try {
    const result = await probeNetwork(network, payload as Record<string, string>);
    await setValidationStatus(db, tenantId, network, result.valid ? 'active' : 'invalid');
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await setValidationStatus(db, tenantId, network, 'invalid');
    return { valid: false, error: msg };
  }
}

/**
 * Lightweight read probe per network.
 * Returns {valid: true} on 2xx; {valid: false, error} on 4xx/network error.
 */
async function probeNetwork(
  network: AffiliateNetwork,
  creds: Record<string, string>,
): Promise<{ valid: boolean; error?: string }> {
  let url: string;
  let headers: Record<string, string> = {};

  switch (network) {
    case 'impact_radius':
      url = 'https://api.impact.com/Mediapartners/Me';
      headers = { Authorization: `Bearer ${creds.client_secret}` };
      break;
    case 'partnerstack':
      url = 'https://api.partnerstack.com/api/v2/programs?limit=1';
      headers = { Authorization: `Basic ${btoa(`${creds.api_key}:`)}` };
      break;
    case 'cj':
      url = 'https://commission-detail.api.cj.com/v3/commissions?date-type=event&start-date=2024-01-01&end-date=2024-01-02';
      headers = { Authorization: `Bearer ${creds.api_key}` };
      break;
    case 'shareasale':
      url = 'https://shareasale.com/x.cfm?action=ping';
      headers = { 'x-shareasale-token': creds.api_token };
      break;
    case 'clickbank':
      url = `https://api.clickbank.com/rest/1.3/analytics/sale?vendor=${encodeURIComponent(creds.clerk_key)}&startDate=2024-01-01&endDate=2024-01-02`;
      headers = { Authorization: creds.api_key, Accept: 'application/json' };
      break;
    case 'binance':
      url = 'https://api.binance.com/api/v3/account';
      headers = { 'X-MBX-APIKEY': creds.api_key };
      break;
    case 'bybit':
      url = 'https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED';
      headers = { 'X-BAPI-API-KEY': creds.api_key };
      break;
    case 'bitget':
      url = 'https://api.bitget.com/api/spot/v1/account/assets';
      headers = { 'ACCESS-KEY': creds.api_key, 'ACCESS-PASSPHRASE': creds.passphrase ?? '' };
      break;
    case 'coinbase':
      url = 'https://api.coinbase.com/v2/user';
      headers = { Authorization: `Bearer ${creds.api_key}` };
      break;
    default:
      return { valid: false, error: 'Unknown network' };
  }

  try {
    const res = await fetch(url, { method: 'GET', headers });
    if (res.status === 429) return { valid: false, error: 'Rate limited' };
    if (res.status === 401 || res.status === 403)
      return { valid: false, error: `Auth rejected (HTTP ${res.status})` };
    if (res.ok) return { valid: true };
    return { valid: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
