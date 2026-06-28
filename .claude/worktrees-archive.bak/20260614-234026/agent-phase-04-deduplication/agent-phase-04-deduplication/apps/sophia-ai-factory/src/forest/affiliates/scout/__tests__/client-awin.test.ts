import { describe, it, expect, vi, afterEach } from 'vitest';
import { awinSaasClient } from '../client-awin';
const env = () => ({ AWIN_API_TOKEN: 'tok', AWIN_PUBLISHER_ID: '111' });
const FIX = [
  { id: 201, name: 'HubSpot CRM', displayUrl: 'https://hubspot.com', primarySector: 'Software', commissionRange: { max: 30 }, epcThreeMonth: 3.5 },
  { id: 202, name: 'Physical Store', displayUrl: 'https://store.com', primarySector: 'Retail', commissionRange: { max: 8 }, epcThreeMonth: 0.2 },
];
describe('awinSaasClient', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('network=awin_saas', () => { expect(awinSaasClient.network).toBe('awin_saas'); });
  it('[] without token', async () => { expect(await awinSaasClient.fetch({ AWIN_PUBLISHER_ID: 'x' }, 't')).toEqual([]); });
  it('[] without publisher id', async () => { expect(await awinSaasClient.fetch({ AWIN_API_TOKEN: 'x' }, 't')).toEqual([]); });
  it('[] on HTTP error', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 })); expect(await awinSaasClient.fetch(env(), 't')).toEqual([]); });
  it('[] on exception', async () => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail'))); expect(await awinSaasClient.fetch(env(), 't')).toEqual([]); });
  it('filters non-SaaS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => FIX }));
    const r = await awinSaasClient.fetch(env(), 't');
    expect(r.map(x => x.productName)).not.toContain('Physical Store');
    expect(r.map(x => x.productName)).toContain('HubSpot CRM');
  });
  it('maps fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [FIX[0]] }));
    const [a] = await awinSaasClient.fetch(env(), 't');
    expect(a.network).toBe('awin_saas');
    expect(a.externalId).toBe('201');
    expect(a.commissionPct).toBe(30);
    expect(a.epc).toBe(3.5);
  });
  it('handles programmes wrapper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ programmes: FIX }) }));
    expect(Array.isArray(await awinSaasClient.fetch(env(), 't'))).toBe(true);
  });
  it('caps at 50', async () => {
    const big = Array.from({length:60},(_,i) => ({id:i,name:`SaaS${i}`,primarySector:'Software',commissionRange:{max:10},epcThreeMonth:1}));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => big }));
    expect((await awinSaasClient.fetch(env(), 't')).length).toBeLessThanOrEqual(50);
  });
  it('uses credentialsOverride', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', spy);
    await awinSaasClient.fetch({}, 't', { api_token: 'ov', publisher_id: '999' });
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0] as string).toContain('999');
  });
});
