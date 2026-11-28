import { describe, it, expect } from 'vitest';
import {
  CHANNEL_PROVIDERS,
  EXECUTABLE_CHANNEL_PROVIDERS,
  findUnsupportedChannelProviders,
} from '../distribute-helpers';

describe('Omnichannel Distribution G2: Provider capability reconciliation guard', () => {
  it('allows the 10 executable providers implemented in publisher-factory', () => {
    const supported = [
      'tiktok',
      'youtube',
      'instagram',
      'facebook',
      'twitter',
      'pinterest',
      'linkedin',
      'zalo',
      'threads',
      'telegram',
    ] as const;
    expect(EXECUTABLE_CHANNEL_PROVIDERS.size).toBe(10);
    expect(findUnsupportedChannelProviders([...supported])).toEqual([]);
  });

  it('rejects API-only unimplemented providers (reddit, bluesky, mastodon) fail-closed', () => {
    expect(CHANNEL_PROVIDERS).toHaveLength(13);
    expect(findUnsupportedChannelProviders(['tiktok', 'reddit', 'bluesky', 'mastodon'])).toEqual([
      'reddit',
      'bluesky',
      'mastodon',
    ]);
  });
});
