/**
 * Syndication Pacer Tests
 *
 * @module tree/social/syndication/__tests__/pacer.test
 */

import { describe, it, expect } from 'vitest';
import { calculatePublishingDelay } from '../syndication-pacer';

describe('Syndication Pacer', () => {
    it('calculates staggered delay correctly', () => {
        const delay = calculatePublishingDelay('tiktok', 0);
        expect(delay).toBeGreaterThanOrEqual(15 * 60 * 1000); // 15 mins base
        expect(delay).toBeLessThan(21 * 60 * 1000); // base + 5m jitter
    });

    it('increases delay with existing content count', () => {
        const delay = calculatePublishingDelay('tiktok', 2);
        // Base 15m * (2*2 = 4x) = 60m base delay + jitter
        expect(delay).toBeGreaterThanOrEqual(60 * 60 * 1000);
    });
});
