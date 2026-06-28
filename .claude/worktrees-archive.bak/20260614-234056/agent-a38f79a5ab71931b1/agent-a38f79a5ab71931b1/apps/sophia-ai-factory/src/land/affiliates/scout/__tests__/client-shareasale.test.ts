import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shareasaleClient } from '../client-shareasale';
const env = () => ({ SHAREASALE_TOKEN: 'tok', SHAREASALE_AFFILIATE_ID: '999' });
const FIX = [
  { merchantID: '101', merchantName: 'FreshBooks Cloud', www: 'https://freshbooks.com', category: 'Software', commission: '30', EPC: '1.25' },
  { merchantID: '102', merchantName: 'Fashion Store', www: 'https://x.com', category: 'Fashion', commission: '5', EPC: '0.1' },
];
describe('shareasaleClient', () => {
  beforeEach(() => { vi.stubGlobal('crypto', { subtle: { importKey: vi.fn().mockResolvedValue('k'), sign: vi.fn().mockResolvedValue(new Uint8Array([1,2]).buffer) } }); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('network=shareasale', () => { expect(shareasaleClient.network).toBe('shareasale'); });
  it('[] without token', async () => { expect(await shareasaleClient.fetch({ SHAREASALE_AFFILIATE_ID: 'x' }, 't')).toEqual([]); });
  it('[] without affiliate id', async () => { expect(await shareasaleClient.fetch({ SHAREASALE_TOKEN: 'x' }, 't')).toEqual([]); });
  it('[] on HTTP error', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 })); expect(await shareasaleClient.fetch(env(), 't')).toEqual([]); });
  it('[] on exception', async () => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail'))); expect(await shareasaleClient.fetch(env(), 't')).toEqual([]); });
  it('filters non-SaaS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ merchants: FIX }) }));
    const r = await shareasaleClient.fetch(env(), 't');
    expect(r.map(x => x.productName)).not.toContain('Fashion Store');
  });
  it('maps fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ merchants: [FIX[0]] }) }));
    const [a] = await shareasaleClient.fetch(env(), 't');
    expect(a.network).toBe('shareasale');
    expect(a.externalId).toBe('101');
    expect(a.commissionPct).toBe(30);
    expect(a.epc).toBe(1.25);
  });
  it('handles array response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => FIX }));
    expect(Array.isArray(await shareasaleClient.fetch(env(), 't'))).toBe(true);
  });
  it('uses credentialsOverride', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', spy);
    await shareasaleClient.fetch({}, 't', { api_token: 'ov', affiliate_id: 'oid' });
    expect(spy).toHaveBeenCalled();
  });
});
