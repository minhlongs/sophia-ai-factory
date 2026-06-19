/**
 * Awin SaaS affiliate scout client. network='awin_saas'.
 * @module lib/affiliates/scout/client-awin
 */
import type { NetworkClient, ScoutEnv, Affiliate } from './types';
import { logger } from '@/seed/utils/logger-utility';

type AffiliateRaw = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;
const API_BASE = 'https://api.awin.com/publishers';
const SAAS_RE = /software|saas|cloud|crm|erp|platform|analytics|email|seo|accounting|project|marketing/i;
interface AwinProg { id?: number | string; name?: string; displayUrl?: string; commissionRange?: { min?: number; max?: number }; epcHistoric?: number | null; epcThreeMonth?: number | null; description?: string; primarySector?: string; }
function map(p: AwinProg): AffiliateRaw {
  const cp = p.commissionRange?.max ?? p.commissionRange?.min;
  const ep = p.epcThreeMonth ?? p.epcHistoric ?? undefined;
  const dom = p.displayUrl ? String(p.displayUrl).replace(/^https?:\/\//, '').split('/')[0] : undefined;
  return { network: 'awin_saas', externalId: String(p.id ?? ''), productName: String(p.name ?? ''), productUrl: p.displayUrl ? String(p.displayUrl) : undefined, commissionPct: cp !== undefined && !isNaN(cp) ? cp : undefined, category: p.primarySector ? String(p.primarySector) : 'SaaS', description: p.description ? String(p.description).slice(0, 500) : undefined, epc: ep !== undefined && ep !== null && !isNaN(Number(ep)) ? Number(ep) : undefined, domain: dom, rawPayload: JSON.stringify(p) } satisfies AffiliateRaw;
}
export const awinSaasClient: NetworkClient = {
  network: 'awin_saas',
  async fetch(env: ScoutEnv, _t: string, creds?: Record<string, string>): Promise<AffiliateRaw[]> {
    const tok = creds?.['api_token'] ?? env.AWIN_API_TOKEN;
    const pid = creds?.['publisher_id'] ?? env.AWIN_PUBLISHER_ID;
    if (!tok || !pid) { logger.warn('[affiliate-scout] AWIN credentials missing'); return []; }
    try {
      const url = `${API_BASE}/${pid}/programmes?${new URLSearchParams({ relationship: 'joined', countryCode: 'US', pageSize: '50' })}`;
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
      let res: Response;
      try { res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` }, signal: ctrl.signal }); } finally { clearTimeout(t); }
      if (!res.ok) { logger.warn(`[affiliate-scout] Awin HTTP ${res.status}`); return []; }
      const body = await res.json() as AwinProg[] | { programmes?: AwinProg[] };
      const progs: AwinProg[] = Array.isArray(body) ? body : (body.programmes ?? []);
      return progs.filter(p => /software/i.test(String(p.primarySector ?? '')) || SAAS_RE.test(String(p.name ?? '')) || SAAS_RE.test(String(p.description ?? ''))).slice(0, 50).map(map);
    } catch (err) { logger.error('[affiliate-scout] Awin error', { err }); return []; }
  }
};
