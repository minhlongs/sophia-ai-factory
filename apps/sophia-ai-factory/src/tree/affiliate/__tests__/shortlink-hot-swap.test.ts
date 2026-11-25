/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import {
  hotSwapShortlinkDestination,
  validateHotSwapDestinationUrl,
} from '../shortlink-hot-swap';

describe('Shortlink Hot-Swap (Affiliate Sovereignty Layer 1)', () => {
  it('validates HTTPS URLs and blocks javascript:, http:, localhost, and private IPs', () => {
    expect(validateHotSwapDestinationUrl('https://partner.notion.so/ref').ok).toBe(true);
    expect(validateHotSwapDestinationUrl('not-a-url').ok).toBe(false);
    expect(validateHotSwapDestinationUrl('javascript:alert(1)').ok).toBe(false);
    expect(validateHotSwapDestinationUrl('http://example.com').ok).toBe(false);
    expect(validateHotSwapDestinationUrl('https://localhost:3000/a').ok).toBe(false);
    expect(validateHotSwapDestinationUrl('https://192.168.1.1/admin').ok).toBe(false);
    expect(validateHotSwapDestinationUrl('https://internal.local/x').ok).toBe(false);
  });

  it('updates destination_url scoped by (id, org_id) and rejects cross-tenant swaps', async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const bind = vi.fn().mockReturnValue({ run });
    const db = { prepare: vi.fn().mockReturnValue({ bind }) };

    const okRes = await hotSwapShortlinkDestination({
      db,
      orgId: 'org_1',
      linkId: 'lnk_1',
      newDestinationUrl: 'https://accounts.binance.com/register?ref=NEW123',
      nowIso: '2026-11-25T16:00:00Z',
    });
    expect(okRes.ok).toBe(true);
    if (okRes.ok) {
      expect(okRes.value.destinationUrl).toBe('https://accounts.binance.com/register?ref=NEW123');
    }

    run.mockResolvedValueOnce({ meta: { changes: 0 } });
    const crossTenantRes = await hotSwapShortlinkDestination({
      db,
      orgId: 'org_other',
      linkId: 'lnk_1',
      newDestinationUrl: 'https://partner.example.com/offer',
    });
    expect(crossTenantRes.ok).toBe(false);
  });
});
