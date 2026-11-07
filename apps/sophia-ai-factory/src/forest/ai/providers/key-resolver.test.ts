import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveUserApiKey: vi.fn(),
  isByokEnabled: vi.fn(),
}));

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: mocks.resolveUserApiKey,
  isByokEnabled: mocks.isByokEnabled,
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { debug: vi.fn(), warn: vi.fn() },
}));

import { resolveApiKey } from './key-resolver';

describe('resolveApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isByokEnabled.mockReturnValue(true);
  });

  it('uses the user key when BYOK resolution succeeds', async () => {
    mocks.resolveUserApiKey.mockResolvedValue('user-key');

    await expect(resolveApiKey('user-1', 'openrouter', 'platform-key')).resolves.toBe('user-key');
  });

  it('uses platform fallback only when the BYOK resolver reports true absence', async () => {
    mocks.resolveUserApiKey.mockResolvedValue(null);

    await expect(resolveApiKey('user-1', 'openrouter', 'platform-key')).resolves.toBe('platform-key');
  });

  it.each(['STORE_UNAVAILABLE', 'DECRYPT_FAILED', 'KEY_VERSION_UNSUPPORTED'])(
    'does not use platform fallback when BYOK fails with %s',
    async (code) => {
      mocks.resolveUserApiKey.mockRejectedValue(Object.assign(new Error(`BYOK_${code}`), { code }));

      await expect(resolveApiKey('user-1', 'openrouter', 'platform-key')).rejects.toMatchObject({ code });
    },
  );

  it('maps Kling to the fal-ai BYOK credential', async () => {
    mocks.resolveUserApiKey.mockResolvedValue('fal-key');

    await resolveApiKey('user-1', 'kling-video', 'platform-key');

    expect(mocks.resolveUserApiKey).toHaveBeenCalledWith('user-1', 'fal-ai');
  });
});
