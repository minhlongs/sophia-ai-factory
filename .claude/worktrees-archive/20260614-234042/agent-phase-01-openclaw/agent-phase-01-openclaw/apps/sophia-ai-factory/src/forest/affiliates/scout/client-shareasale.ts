/**
 * ShareASale affiliate network scout client.
 * Auth: HMAC-SHA256 signature. Falls back to [] when credentials absent.
 * @module lib/affiliates/scout/client-shareasale
 */
import type { NetworkClient, ScoutEnv, Affiliate } from './types';
import { logger } from '@/seed/utils/logger-utility';

type AffiliateRaw = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;
const API_BASE = 'https://api.shareasale.com/x.cfm';
const API_VERSION = '2.8';
const ACTION_VERB = 'getMerchantList';
const SAAS_RE = /software|saas|cloud|crm|erp|platform|tool|app|email|seo|analytics|project|accounting|marketing/i;

async function buildSig(token: string, ts: string): Promise<string> {
  const msg = `${token}:${ts}:${API_VERSION}:${ACTION_VERB}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(token), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
interface SasMerchant { merchantID?: string | number; merchantName?: string; www?: string; category?: string; description?: string; commission?: string | number; EPC?: string | number; networkEarnings?: string | number; }
function map(m: SasMerchant): AffiliateRaw {
  const craw = m.commission ?? m.networkEarnings;
  const cp = craw !== undefined && String(craw) !== '' ? parseFloat(String(craw)) : undefined;
  const ep = m.EPC !== undefined && String(m.EPC) !== '' ? parseFloat(String(m.EPC)) : undefined;
  const dom = m.www ? String(m.www).replace(/^https?:\/\//, '').split('/')[0] : undefined;
  return { network: 'shareasale', externalId: String(m.merchantID ?? ''), productName: String(m.merchantName ?? ''), productUrl: m.www ? String(m.www) : undefined, commissionPct: cp !== undefined && !isNaN(cp) ? cp : undefined, category: m.category ? String(m.category) : undefined, description: m.description ? String(m.description).slice(0, 500) : undefined, epc: ep !== undefined && !isNaN(ep) ? ep : undefined, domain: dom, rawPayload: JSON.stringify(m) } satisfies AffiliateRaw;
}
export const shareasaleClient: NetworkClient = {
  network: 'shareasale',
  async fetch(env: ScoutEnv, _t: string, creds?: Record<string, string>): Promise<AffiliateRaw[]> {
    const tok = creds?.['api_token'] ?? env.SHAREASALE_TOKEN;
    const aid = creds?.['affiliate_id'] ?? env.SHAREASALE_AFFILIATE_ID;
    if (!tok || !aid) { logger.warn('[affiliate-scout] SHAREASALE credentials missing'); return []; }
    try {
      const ts = new Date().toUTCString();
      const sig = await buildSig(tok, ts);
      const url = `${API_BASE}?${new URLSearchParams({ action: ACTION_VERB, affiliateId: aid, version: API_VERSION, category: 'software', pageSize: '50', sortCol: 'EPC', sortDir: 'DESC', XMLFormat: '1' })}`;
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
      let res: Response;
      try { res = await fetch(url, { headers: { 'x-ShareASale-Date': ts, 'x-ShareASale-Authentication': sig, 'x-ShareASale-APIVersion': API_VERSION, Accept: 'application/json' }, signal: ctrl.signal }); } finally { clearTimeout(t); }
      if (!res.ok) { logger.warn(`[affiliate-scout] ShareASale HTTP ${res.status}`); return []; }
      const body = await res.json() as { merchants?: SasMerchant[] } | SasMerchant[];
      const ms: SasMerchant[] = Array.isArray(body) ? body : (body.merchants ?? []);
      return ms.filter(m => SAAS_RE.test(String(m.merchantName ?? '')) || SAAS_RE.test(String(m.category ?? ''))).map(map);
    } catch (err) { logger.error('[affiliate-scout] ShareASale error', { err }); return []; }
  }
};
