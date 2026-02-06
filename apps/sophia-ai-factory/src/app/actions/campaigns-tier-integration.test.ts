import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCampaign } from './campaigns';
import { tierGuard } from '@/lib/tier-guard';
import { inngest } from '@/lib/inngest/client';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } }
      })
    }
  })
}));

const mocks = vi.hoisted(() => {
    const insertMock = vi.fn().mockReturnThis();
    const selectMock = vi.fn().mockReturnThis();
    const singleMock = vi.fn().mockResolvedValue({
        data: { id: 'campaign-123' },
        error: null
    });

    // Mock for user profile lookup
    const singleProfileMock = vi.fn().mockResolvedValue({
        data: { subscription_tier: 'basic' }
    });

    const eqMock = vi.fn().mockImplementation((field) => {
        if (field === 'user_id') return { single: singleProfileMock };
        return { single: singleMock };
    });

    // The chain object needs all methods used in the chain
    const chainObj = {
        insert: insertMock,
        select: selectMock,
        eq: eqMock,
        single: singleMock
    };

    const fromMock = vi.fn().mockReturnValue(chainObj);

    return {
        insert: insertMock,
        select: selectMock,
        single: singleMock,
        eq: eqMock,
        from: fromMock
    }
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: mocks.from,
    auth: {
      admin: {
        listUsers: vi.fn()
      }
    }
  })
}));

vi.mock('@/lib/inngest/client', () => ({
    inngest: {
        send: vi.fn()
    }
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

vi.mock('@/lib/tier-guard');

describe('createCampaign Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variables for getSupabaseAdmin
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('should prevent BASIC user from creating multi-channel campaign', async () => {
    // Mock tierGuard to deny multi-channel access
    vi.mocked(tierGuard.checkMultiChannelAccess).mockResolvedValue(false);

    const formData = new FormData();
    formData.append('title', 'Test Campaign');
    formData.append('topic', 'Test Topic');
    formData.append('audience', 'General');
    // Add multiple platforms
    formData.append('platforms', 'youtube');
    formData.append('platforms', 'tiktok');

    const result = await createCampaign(formData);

    expect(result.success).toBe(false);
    expect(result.requiresUpgrade).toBe(true);
    expect(result.requiredTier).toBe('PREMIUM');
    expect(tierGuard.checkMultiChannelAccess).toHaveBeenCalledWith('test-user-id');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('should allow PREMIUM user to create multi-channel campaign', async () => {
    // Mock tierGuard to allow access
    vi.mocked(tierGuard.checkMultiChannelAccess).mockResolvedValue(true);

    const formData = new FormData();
    formData.append('title', 'Test Campaign');
    formData.append('topic', 'Test Topic');
    formData.append('audience', 'General');
    formData.append('platforms', 'youtube');
    formData.append('platforms', 'tiktok');

    const result = await createCampaign(formData);

    expect(tierGuard.checkMultiChannelAccess).toHaveBeenCalledWith('test-user-id');
    expect(mocks.insert).toHaveBeenCalled();
    expect(inngest.send).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('should allow BASIC user to create single-channel campaign', async () => {
    // Should NOT call checkMultiChannelAccess for single channel
    // Or it might not matter, but logic says check if platforms > 1

    const formData = new FormData();
    formData.append('title', 'Test Campaign');
    formData.append('topic', 'Test Topic');
    formData.append('audience', 'General');
    formData.append('platforms', 'youtube');

    const result = await createCampaign(formData);

    expect(tierGuard.checkMultiChannelAccess).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
