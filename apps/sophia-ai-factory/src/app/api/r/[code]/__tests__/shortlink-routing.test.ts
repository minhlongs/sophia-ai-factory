import { describe, it, expect } from 'vitest';
import { getSubIdParam } from '../redirect-helpers';

describe('Shortlink Routing & SubID Parameters', () => {
  it('maps affiliate networks to their expected SubID query parameters', () => {
    expect(getSubIdParam('clickbank')).toBe('tid');
    expect(getSubIdParam('tiktok_shop')).toBe('aff_sub');
    expect(getSubIdParam('tiktok-shop')).toBe('aff_sub');
    expect(getSubIdParam('accesstrade')).toBe('utm_content');
    expect(getSubIdParam('awin')).toBe('clickref');
    expect(getSubIdParam('amazon')).toBe('tag');
    expect(getSubIdParam('amazon_associates')).toBe('tag');
    expect(getSubIdParam('unknown_network')).toBe('sub_id');
  });
});
