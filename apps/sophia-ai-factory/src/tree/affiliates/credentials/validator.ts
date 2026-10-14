import { AffiliateNetwork } from './types';
import { getCredentials } from './storage';

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
    const result = await probeNetwork(network, payload as unknown as Record<string, string>);
    await setValidationStatus(db, tenantId, network, result.valid ? 'active' : 'invalid');
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await setValidationStatus(db, tenantId, network, 'invalid');
    return { valid: false, error: msg };
  }
}
