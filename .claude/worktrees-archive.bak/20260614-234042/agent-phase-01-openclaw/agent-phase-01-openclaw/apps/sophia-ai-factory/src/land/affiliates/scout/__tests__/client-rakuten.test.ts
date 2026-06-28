import { describe, it, expect, vi, afterEach } from 'vitest';
import { rakutenClient } from '../client-rakuten';
const env = () => ({ RAKUTEN_TOKEN: 'tok' });
const FIX = [
  { advertiser_id: '301', advertiser_name: 'Pipedrive CRM', advertiser_url: 'https://pipedrive.com', category: 'SaaS', commission_pct: '25', three_month_epc: '2.8', seven_day_epc: '2.1' },
  { advertiser_id: '302', advertiser_name: 'Nike', advertiser_url: 'https://nike.com', category: 'Sportswear', commission_pct: '5', seven_day_epc: '0.3' },
];
describe('rakutenClient', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('network=rakuten', () => { expect(rakutenClient.network).toBe('rakuten'); });
  it('[] without token', async () => { expect(await rakutenClient.fetch({}, 't')).toEqual([]); });
  it('[] on HTTP error', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 })); expect(await rakutenClient.fetch(env(), 't')).toEqual([]); });
  it('[] on exception', async () => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail'))); expect(await rakutenClient.fetch(env(), 't')).toEqual([]); });
  it('filters non-SaaS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => FIX }));
    const r = await rakutenClient.fetch(env(), 't');
    expect(r.map(x => x.productName)).not.toContain('Nike');
    expect(r.map(x => x.productName)).toContain('Pipedrive CRM');
  });
  it('maps fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [FIX[0]] }));
    const [a] = await rakutenClient.fetch(env(), 't');
    expect(a.network).toBe('rakuten');
    expect(a.externalId).toBe('301');
    expect(a.commissionPct).toBe(25);
    expect(a.epc).toBe(2.8);
  });
  it('uses seven_day_epc fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ ...FIX[0], three_month_epc: undefined }] }));
    const [a] = await rakutenClient.fetch(env(), 't');
    expect(a.epc).toBe(2.1);
  });
  it('handles advertisers wrapper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ advertisers: FIX }) }));
    expect(Array.isArray(await rakutenClient.fetch(env(), 't'))).toBe(true);
  });
  it('handles data wrapper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [FIX[0]] }) }));
    expect((await rakutenClient.fetch(env(), 't')).length).toBeGreaterThanOrEqual(1);
  });
  it('caps at 50', async () => {
    const big = Array.from({length:60},(_,i) => ({advertiser_id:String(i),advertiser_name:`SaaS${i}`,category:'SaaS',commission_pct:'20',seven_day_epc:'1.5'}));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => big }));
    expect((await rakutenClient.fetch(env(), 't')).length).toBeLessThanOrEqual(50);
  });
  it('uses credentialsOverride', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', spy);
    await rakutenClient.fetch({}, 't', { api_token: 'ov' });
    expect(spy).toHaveBeenCalled();
  });
});
