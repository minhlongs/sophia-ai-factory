import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCampaign } from './campaigns';
import { tierGuard } from '@/lib/tier-guard';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/forest/inngest/client';

// Mock D1 client — replaces Supabase
const mocks = vi.hoisted(() => {
  const insertMock = vi.fn().mockReturnThis();
  const singleMock = vi.fn().mockResolvedValue({ data: { id: 'campaign-123' }, error: null });

  // Differentiate profile queries (user_id eq) from campaign queries
  const eqMock = vi.fn().mockImplementation((field: string) => {
    if (field === 'user_id') {
      return { single: vi.fn().mockResolvedValue({ data: { subscription_tier: 'basic' }, error: null }) };
    }
    return { single: singleMock };
  });

  const selectMock = vi.fn().mockReturnValue({ eq: eqMock, single: singleMock, limit: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'test-user-id' }, error: null }) }) });

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'test-user-id' }, error: null })
          })
        })
      };
    }
    if (table === 'user_profiles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { subscription_tier: 'basic' }, error: null })
          })
        })
      };
    }
    // campaigns table — handles both count query and insert
    const gteMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const campaignEqMock = vi.fn().mockReturnValue({ gte: gteMock });
    const campaignSelectMock = vi.fn().mockReturnValue({ eq: campaignEqMock });
    return {
      select: campaignSelectMock,
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'campaign-123' }, error: null })
        })
      })
    };
  });

  return { insert: insertMock, select: selectMock, eq: eqMock, single: singleMock, from: fromMock };
});

vi.mock('@/seed/db/client', () => ({
  getD1Client: vi.fn().mockResolvedValue({ from: mocks.from }),
  createServerClient: vi.fn().mockReturnValue({ from: mocks.from }),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/forest/inngest/client', () => ({
  inngest: { send: vi.fn() }
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

vi.mock('@/lib/tier-guard');

describe('createCampaign Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getCurrentUser to return a test user
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user'
    });

    // Reset mocks to default values
    vi.mocked(mocks.from).mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'test-user-id' }, error: null })
            })
          })
        };
      }
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { subscription_tier: 'basic' }, error: null })
            })
          })
        };
      }
      // campaigns table — handles both count query and insert
      const gteMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const campaignEqMock = vi.fn().mockReturnValue({ gte: gteMock });
      const campaignSelectMock = vi.fn().mockReturnValue({ eq: campaignEqMock });
      return {
        select: campaignSelectMock,
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'campaign-123' }, error: null })
          })
        })
      };
    });
  });

  it('should prevent BASIC user from creating multi-channel campaign', async () => {
    vi.mocked(tierGuard.checkMultiChannelAccess).mockResolvedValue(false);

    const formData = new FormData();
    formData.append('title', 'Test Campaign');
    formData.append('topic', 'Test Topic');
    formData.append('audience', 'General');
    formData.append('platforms', 'youtube');
    formData.append('platforms', 'tiktok');

    const result = await createCampaign(formData);

    expect(result.success).toBe(false);
    expect(result.requiresUpgrade).toBe(true);
    expect(result.requiredTier).toBe('PREMIUM');
    expect(tierGuard.checkMultiChannelAccess).toHaveBeenCalledWith('test-user-id');
  });

  it('should allow PREMIUM user to create multi-channel campaign', async () => {
    vi.mocked(tierGuard.checkMultiChannelAccess).mockResolvedValue(true);

    const formData = new FormData();
    formData.append('title', 'Test Campaign');
    formData.append('topic', 'Test Topic');
    formData.append('audience', 'General');
    formData.append('platforms', 'youtube');
    formData.append('platforms', 'tiktok');

    const result = await createCampaign(formData);

    expect(tierGuard.checkMultiChannelAccess).toHaveBeenCalledWith('test-user-id');
    expect(inngest.send).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('should allow BASIC user to create single-channel campaign', async () => {
    const formData = new FormData();
    formData.append('title', 'Test Campaign');
    formData.append('topic', 'Test Topic');
    formData.append('audience', 'General');
    formData.append('platforms', 'youtube');

    const result = await createCampaign(formData);

    expect(tierGuard.checkMultiChannelAccess).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
