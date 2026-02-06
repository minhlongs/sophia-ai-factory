import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTemplate } from './templates';
import { tierGuard } from '@/lib/tier-guard';

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
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn().mockReturnValue({
        insert: insertMock
    });
    return {
        insert: insertMock,
        from: fromMock
    }
});

// Mock Supabase admin client
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

vi.mock('@/lib/tier-guard');

describe('createTemplate Integration', () => {
  const mockTemplateData = {
    name: 'My Custom Template',
    description: 'A custom template',
    category: 'welcome' as const,
    defaults: {
      title: 'Welcome',
      audience: 'New Users',
      tone: 'friendly' as const,
      suggestedDuration: 60,
      keywords: ['welcome']
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variables for getSupabaseAdmin
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  it('should prevent BASIC user from creating custom template', async () => {
    // Mock tierGuard to deny access
    vi.mocked(tierGuard.checkLimit).mockResolvedValue({
      allowed: false,
      limit: 0,
      currentusage: 0,
      requiredTier: 'ENTERPRISE',
      message: 'Upgrade to ENTERPRISE for custom templates'
    });

    const result = await createTemplate(mockTemplateData);

    expect(result.success).toBe(false);
    expect(result.requiresUpgrade).toBe(true);
    expect(result.requiredTier).toBe('ENTERPRISE');
    expect(tierGuard.checkLimit).toHaveBeenCalledWith('test-user-id', 'videoTemplates');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('should allow ENTERPRISE user to create custom template', async () => {
    // Mock tierGuard to allow access
    vi.mocked(tierGuard.checkLimit).mockResolvedValue({
      allowed: true,
      limit: 999,
      currentusage: 5,
      requiredTier: 'ENTERPRISE'
    });

    const result = await createTemplate(mockTemplateData);

    expect(tierGuard.checkLimit).toHaveBeenCalledWith('test-user-id', 'videoTemplates');
    expect(mocks.insert).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
