import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserProfile, updateUserProfile } from './settings';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/utils/encryption';
import { revalidatePath } from 'next/cache';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/utils/encryption', () => ({
  encrypt: vi.fn((val) => `encrypted_${val}`),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Settings Server Actions', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockSupabase: any = {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createClient as any).mockResolvedValue(mockSupabase);

    // Reset chainable mocks
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.single.mockReturnThis();
    mockSupabase.update.mockReturnThis();
  });

  describe('getUserProfile', () => {
    it('should throw if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Auth error') });
      await expect(getUserProfile()).rejects.toThrow('Unauthorized');
    });

    it('should return default profile if no profile exists', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', user_metadata: { full_name: 'Test User' } } },
        error: null
      });
      // Profile fetch returns error/null
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await getUserProfile();

      expect(result).toEqual({
        fullName: 'Test User',
        settings: {
          theme: 'system',
          notifications: {
            email: {
              marketing: false,
              security: true,
              updates: true,
            },
            telegram: {
              enabled: false,
            }
          }
        },
        apiKeys: { openai: '', anthropic: '', elevenlabs: '' },
      });
    });

    it('should return profile with masked keys', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', user_metadata: { full_name: 'Test User' } } },
        error: null
      });

      const mockProfile = {
        user_id: 'user-123',
        settings: {
            theme: 'dark',
            notifications: {
                email: { marketing: true, security: true, updates: false },
                telegram: { enabled: true }
            }
        },
        api_keys: {
          openai: 'enc_openai',
          anthropic: 'enc_anthropic',
          elevenlabs: null
        }
      };

      mockSupabase.single.mockResolvedValue({ data: mockProfile, error: null });

      const result = await getUserProfile();

      expect(result.fullName).toBe('Test User');
      expect(result.settings.theme).toBe('dark');
      expect(result.settings.notifications.telegram.enabled).toBe(true);
      expect(result.apiKeys.openai).toBe('********');
      expect(result.apiKeys.anthropic).toBe('********');
      expect(result.apiKeys.elevenlabs).toBe('');
    });
  });

  describe('updateUserProfile', () => {
    const validData = {
      fullName: 'Updated Name',
      settings: {
        theme: 'light' as const,
        notifications: {
          email: { marketing: false, security: true, updates: true },
          telegram: { enabled: false }
        }
      },
      apiKeys: {
        openai: 'sk-new-key',
        anthropic: '********', // masked, shouldn't change
        elevenlabs: '' // empty, shouldn't change unless we handle delete logic (current logic: empty = delete if not masked? No, code says: if empty delete from encryptedKeys)
      }
    };

    it('should return error if unauthorized', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Auth error') });
      const result = await updateUserProfile(validData);
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should update profile and encrypt new keys', async () => {
      const userId = 'user-123';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, user_metadata: { full_name: 'Old Name' } } },
        error: null
      });

      // Mock fetching current keys
      const currentKeys = { openai: 'enc_old', anthropic: 'enc_anthropic_old' };
      mockSupabase.single.mockResolvedValue({ data: { api_keys: currentKeys }, error: null });

      // Mock update success
      // The update chain is: .update(...).eq(...) -> await
      // The fetch chain is: .select(...).eq(...).single() -> await
      // So eq is called twice. First time it must return 'this' (to chain single), second time it returns the result.
      mockSupabase.eq
        .mockReturnValueOnce(mockSupabase)
        .mockResolvedValueOnce({ error: null });

      const result = await updateUserProfile(validData);

      expect(result).toEqual({ success: true });

      // Check auth update for name
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        data: { full_name: 'Updated Name' }
      });

      // Check encryption called for new key
      expect(encrypt).toHaveBeenCalledWith('sk-new-key');

      // Check update call
      expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
        settings: validData.settings,
        api_keys: expect.objectContaining({
          openai: 'encrypted_sk-new-key',
          anthropic: 'enc_anthropic_old', // preserved
          // elevenlabs should be deleted/missing because it was empty string in input
        }),
        updated_at: expect.any(String)
      }));

      expect(revalidatePath).toHaveBeenCalledWith('/settings');
    });

    it('should handle update error', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', user_metadata: { full_name: 'Test' } } },
          error: null
        });
        mockSupabase.single.mockResolvedValue({ data: { api_keys: {} }, error: null });

        // Fix mock chain: update -> eq -> error
        // eq called first for fetch (return this), then for update (return error)
        mockSupabase.eq
          .mockReturnValueOnce(mockSupabase)
          .mockResolvedValueOnce({ error: new Error('DB Error') });

        const result = await updateUserProfile(validData);

        expect(result).toEqual({ error: 'Failed to update profile' });
      });
  });
});
