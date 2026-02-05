import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { tierGuard } from '@/lib/tier-guard';
import { checkTierAccess } from '@/lib/features';

// Mock dependencies
vi.mock('@/lib/tier-guard');
vi.mock('@/lib/features');

// Mock NextResponse
vi.mock('next/server', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(actual as any),
        NextResponse: {
            json: vi.fn((body, init) => ({
                body,
                status: init?.status || 200,
            })),
        },
    };
});

describe('API check-access Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 403 if limit reached', async () => {
        // Mock tierGuard checkLimit
        vi.mocked(tierGuard.checkLimit).mockResolvedValue({
            allowed: false,
            limit: 5,
            currentusage: 5,
            requiredTier: 'PREMIUM',
            message: 'Limit reached'
        });

        const req = new NextRequest('http://localhost:3000/api/check-access?limit=youtubeChannels&userId=user-123');
        const response = await GET(req);

        expect(tierGuard.checkLimit).toHaveBeenCalledWith('user-123', 'youtubeChannels');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((response as any).status).toBe(403);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((response as any).body).toMatchObject({
            allowed: false,
            upgradeRequired: true
        });
    });

    it('should return 200 if limit allowed', async () => {
        vi.mocked(tierGuard.checkLimit).mockResolvedValue({
            allowed: true,
            limit: 5,
            currentusage: 2,
            requiredTier: 'PREMIUM'
        });

        const req = new NextRequest('http://localhost:3000/api/check-access?limit=youtubeChannels&userId=user-123');
        const response = await GET(req);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((response as any).status).toBe(200);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((response as any).body).toMatchObject({
            allowed: true
        });
    });

    it('should check feature access', async () => {
        vi.mocked(checkTierAccess).mockReturnValue({
            hasAccess: true,
            requiredTier: 'BASIC'
        });

        const req = new NextRequest('http://localhost:3000/api/check-access?feature=enable_affiliate_engine&tier=PREMIUM');
        const response = await GET(req);

        expect(checkTierAccess).toHaveBeenCalledWith('PREMIUM', 'enable_affiliate_engine');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((response as any).status).toBe(200);
    });

    it('should return 403 for denied feature access', async () => {
        vi.mocked(checkTierAccess).mockReturnValue({
            hasAccess: false,
            requiredTier: 'ENTERPRISE'
        });

        const req = new NextRequest('http://localhost:3000/api/check-access?feature=enable_admin_dashboard&tier=BASIC');
        const response = await GET(req);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((response as any).status).toBe(403);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((response as any).body).toMatchObject({
            hasAccess: false,
            upgradeRequired: true
        });
    });
});
