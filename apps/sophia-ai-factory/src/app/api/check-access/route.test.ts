import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { tierGuard } from '@/land/tier-guard';
import { checkTierAccess } from '@/land/features';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';

// Type for mock NextResponse.json return value
interface MockResponse {
    body: Record<string, unknown>;
    status: number;
}

// Mock dependencies
vi.mock('@/land/tier-guard');
vi.mock('@/land/features');
vi.mock('@/seed/auth/better-auth-session', () => ({
    getCurrentUserFromHeaders: vi.fn(),
}));
vi.mock('@/seed/db/resolve-user-tier', () => ({
    resolveUserTier: vi.fn(),
}));

// Mock NextResponse
vi.mock('next/server', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as Record<string, unknown>),
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

        // Default: mock getCurrentUserFromHeaders to return authenticated user
        vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({
            id: 'user-123',
            email: 'test@example.com',
            role: 'user'
        });

        vi.mocked(resolveUserTier).mockResolvedValue('BASIC');
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

        const req = new NextRequest('http://localhost:3000/api/check-access?limit=youtubeChannels');
        const response = await GET(req);

        expect(tierGuard.checkLimit).toHaveBeenCalledWith('user-123', 'youtubeChannels');
        expect((response as unknown as MockResponse).status).toBe(403);
        expect((response as unknown as MockResponse).body).toMatchObject({
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

        const req = new NextRequest('http://localhost:3000/api/check-access?limit=youtubeChannels');
        const response = await GET(req);

        expect((response as unknown as MockResponse).status).toBe(200);
        expect((response as unknown as MockResponse).body).toMatchObject({
            allowed: true
        });
    });

    it('should check feature access', async () => {
        // Mock user tier as PREMIUM for this test
        vi.mocked(resolveUserTier).mockResolvedValue('PREMIUM');

        vi.mocked(checkTierAccess).mockReturnValue({
            hasAccess: true,
            requiredTier: 'BASIC'
        });

        const req = new NextRequest('http://localhost:3000/api/check-access?feature=enable_affiliate_engine');
        const response = await GET(req);

        expect(checkTierAccess).toHaveBeenCalledWith('PREMIUM', 'enable_affiliate_engine');
        expect((response as unknown as MockResponse).status).toBe(200);
    });

    it('should return 403 for denied feature access', async () => {
        vi.mocked(checkTierAccess).mockReturnValue({
            hasAccess: false,
            requiredTier: 'ENTERPRISE'
        });

        const req = new NextRequest('http://localhost:3000/api/check-access?feature=enable_admin_dashboard');
        const response = await GET(req);

        expect((response as unknown as MockResponse).status).toBe(403);
        expect((response as unknown as MockResponse).body).toMatchObject({
            hasAccess: false,
            upgradeRequired: true
        });
    });
});
