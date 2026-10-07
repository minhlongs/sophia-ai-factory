/**
 * Geo-Affiliate Router Tests
 *
 * @module land/affiliates/routing/__tests__/geo-router.test
 */

import { describe, it, expect, vi } from 'vitest';
import { getAffiliateRoute } from '../geo-router';
import { mock } from 'node:test';

describe('Geo-Affiliate Router', () => {
    it('routes VN traffic to local offers', () => {
        const mockRequest = {
            headers: {
                get: (h: string) => h === 'cf-ipcountry' ? 'VN' : null
            }
        } as any;

        const route = getAffiliateRoute(mockRequest, 'saas');
        expect(route).toBe('https://affiliate.localvn.com/v1');
    });

    it('routes global traffic to default offers', () => {
        const mockRequest = {
            headers: {
                get: (h: string) => h === 'cf-ipcountry' ? 'US' : null
            }
        } as any;

        const route = getAffiliateRoute(mockRequest, 'crypto');
        expect(route).toBe('https://crypto-global.com');
    });
});
