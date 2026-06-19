/**
 * Rakuten Advertising affiliate scout client.
 * @module lib/affiliates/scout/client-rakuten
 */
import type { NetworkClient, ScoutEnv, Affiliate } from './types';
import { logger } from '@/seed/utils/logger-utility';

type AffiliateRaw = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;
const API_BASE = 'https://api.linksynergy.com/v1';
const SAAS_RE = /software|saas|cloud|crm|erp|platform|analytics|email|seo|accounting|project|marketing/i;
interface RakAdv { advertiser_id?: string | number; advertiser_name?: string; advertiser_url?: string; category?: string; description?: string; seven_day_epc?: string | number; three_month_epc?: string | number; commission_flat_usd?: string | number; commission_pct?: string | number; }
function map(a: RakAdv): AffiliateRaw {
  const cp = a.commission_pct !== undefined && String(a.commission_pct) !== '' ? parseFloat(String(a.commission_pct)) : undefined;
  const cf = a.commission_flat_usd !== undefined && String(a.commission_flat_usd) !== '' ? parseFloat(String(a.commission_flat_usd)) : undefined;
  const ep = a.three_month_epc !== undefined && String(a.three_month_epc) !== '' ? parseFloat(String(a.three_month_epc)) : a.seven_day_epc !== undefined && String(a.seven_day_epc) !== '' ? parseFloat(String(a.seven_day_epc)) : undefined;
  const dom = a.advertiser_url ? String(a.advertiser_url).replace(/^https?:\/\//, '').split('/')[0] : undefined;
  return { network: 'rakuten', externalId: String(a.advertiser_id ?? ''), productName: String(a.advertiser_name ?? ''), productUrl: a.advertiser_url ? String(a.advertiser_url) : undefined, commissionPct: cp !== undefined && !isNaN(cp) ? cp : undefined, commissionFlatUsd: cf !== undefined && !isNaN(cf) ? cf : undefined, category: a.category ? String(a.category) : undefined, description: a.description ? String(a.description).slice(0, 500) : undefined, epc: ep !== undefined && !isNaN(ep) ? ep : undefined, domain: dom, rawPayload: JSON.stringify(a) } satisfies AffiliateRaw;
}
export const rakutenClient: NetworkClient = {
  network: 'rakuten',
  async fetch(env: ScoutEnv, _t: string, creds?: Record<string, string>): Promise<AffiliateRaw[]> {
    const tok = creds?.['api_token'] ?? env.RAKUTEN_TOKEN;
    if (!tok) { logger.warn('[affiliate-scout] RAKUTEN_TOKEN missing'); return []; }
    try {
      const url = `${API_BASE}/advrsearch/programs?${new URLSearchParams({ vertical: 'SaaS', pagesize: '50', pagenumber: '1', sort: 'seven_day_epc', sorttype: 'desc' })}`;
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
      let res: Response;
      try { res = await fetch(url, { headers: { Authorization: `Bearer ${tok}` }, signal: ctrl.signal }); } finally { clearTimeout(t); }
      if (!res.ok) { logger.warn(`[affiliate-scout] Rakuten HTTP ${res.status}`); return []; }
      const body = await res.json() as RakAdv[] | { advertisers?: RakAdv[]; data?: RakAdv[] };
      const advs: RakAdv[] = Array.isArray(body) ? body : (body.advertisers ?? body.data ?? []);
      return advs.filter(a => /saas/i.test(String(a.category ?? '')) || SAAS_RE.test(String(a.advertiser_name ?? '')) || SAAS_RE.test(String(a.description ?? ''))).slice(0, 50).map(map);
    } catch (err) { logger.error('[affiliate-scout] Rakuten error', { err }); return []; }
  }
};
