import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTemplate } from './templates';
import { tierGuard } from '@/land/tier-guard';

// Mock D1 client — replaces Supabase
const mocks = vi.hoisted(() => {
  const insertMock = vi.fn().mockResolvedValue({ error: null });

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
    return { insert: insertMock };
  });

  return { insert: insertMock, from: fromMock };
});

vi.mock('@/seed/db/client', () => ({
  getD1Client: vi.fn().mockResolvedValue({ from: mocks.from }),
  createServerClient: vi.fn().mockReturnValue({ from: mocks.from }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

vi.mock('@/land/tier-guard');

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
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });
  });

  it('should prevent BASIC user from creating custom template', async () => {
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
  });

  it('should allow ENTERPRISE user to create custom template', async () => {
    vi.mocked(tierGuard.checkLimit).mockResolvedValue({
      allowed: true,
      limit: 999,
      currentusage: 5,
      requiredTier: 'ENTERPRISE'
    });

    const result = await createTemplate(mockTemplateData);

    expect(tierGuard.checkLimit).toHaveBeenCalledWith('test-user-id', 'videoTemplates');
    expect(result.success).toBe(true);
  });
});
