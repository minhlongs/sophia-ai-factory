import { describe, it, expect } from 'vitest';
import { PROVIDERS as UI_PROVIDERS } from '../provider-key-card';
import { PROVIDERS as API_PROVIDERS, PostSchema } from '@/app/api/user/byok/byok-route-helpers';
import { validateProviderKey } from '@/tree/byok/key-format-validators';

describe('Model B Self-Serve BYOK HeyGen integration', () => {
  it('exposes heygen in Settings ProviderKeyCard UI list', () => {
    const heygenUi = UI_PROVIDERS.find((p) => p.id === 'heygen');
    expect(heygenUi).toBeDefined();
    expect(heygenUi?.name).toContain('HeyGen');
  });

  it('accepts heygen in /api/user/byok PostSchema and validates format', () => {
    expect(API_PROVIDERS).toContain('heygen');
    const validKey = 'hg_live_token_1234567890abcdef';
    const parsed = PostSchema.safeParse({ provider: 'heygen', key: validKey });
    expect(parsed.success).toBe(true);

    const invalidKey = 'short';
    const failed = PostSchema.safeParse({ provider: 'heygen', key: invalidKey });
    expect(failed.success).toBe(false);
  });

  it('validates heygen token format via validateProviderKey', () => {
    expect(validateProviderKey('heygen', 'M2ViYzQ4N2ItOTk4OS00Y2I0LThhZjI=')).toEqual({
      ok: true,
    });
    expect(validateProviderKey('heygen', 'bad key with spaces!!').ok).toBe(false);
  });
});
