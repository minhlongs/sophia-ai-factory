import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserProfile, updateUserProfile } from './settings';
import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { encrypt } from '@/seed/security/encryption-aes-gcm';
import { revalidatePath } from 'next/cache';

// Mock dependencies
vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/security/encryption-aes-gcm', () => ({
  encrypt: vi.fn((val) => `encrypted_${val}`),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Settings Server Actions', () => {
  interface MockDbClient {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  }

  const mockDb: MockDbClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServerClient).mockReturnValue(mockDb as unknown as ReturnType<typeof createServerClient>);

    // Reset chainable mocks
    mockDb.from.mockReturnThis();
    mockDb.select.mockReturnThis();
    mockDb.eq.mockReturnThis();
    mockDb.single.mockReturnThis();
    mockDb.maybeSingle.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.upsert.mockResolvedValue({ data: null, error: null });
    // Default: from() returns the chainable mockDb (tests override as needed)
    mockDb.from.mockImplementation(() => mockDb);
  });

  describe('getUserProfile', () => {
    it('should throw if user is not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      await expect(getUserProfile()).rejects.toThrow('Unauthorized');
    });

    it('should return default profile if no profile exists', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com', full_name: 'Test User', role: 'user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      // Profile fetch returns error/null
      mockDb.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const result = await getUserProfile();

      expect(result).toEqual({
        fullName: 'Test User',
        email: 'test@example.com',
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
            },
          },
        },
        apiKeys: { openai: '', anthropic: '', elevenlabs: '' },
      });
    });

    it('should return profile with masked keys', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com', full_name: 'Test User', role: 'user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const mockProfile = {
        user_id: 'user-123',
        settings: JSON.stringify({
          theme: 'dark',
          notifications: {
            email: { marketing: true, security: true, updates: false },
            telegram: { enabled: true },
          },
        }),
        api_keys: JSON.stringify({
          openai: 'enc_openai',
          anthropic: 'enc_anthropic',
          elevenlabs: null,
        }),
      };

      mockDb.single.mockResolvedValue({ data: mockProfile, error: null });

      const result = await getUserProfile();

      expect(result.fullName).toBe('Test User');
      expect(result.email).toBe('test@example.com');
      expect(result.settings.theme).toBe('dark');
      expect(result.settings.notifications?.telegram?.enabled).toBe(true);
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
          telegram: { enabled: false },
        },
      },
      apiKeys: {
        openai: 'sk-new-key',
        anthropic: '********', // masked, shouldn't change
        elevenlabs: '',
      },
    };

    it('should return error if unauthorized', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const result = await updateUserProfile(validData);
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should update profile and encrypt new keys', async () => {
      const userId = 'user-123';
      const mockUser = { id: userId, email: 'test@example.com', full_name: 'Old Name', role: 'user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      // Mock the from() call chain for both users table update and user_profiles fetch/upsert
      mockDb.from.mockImplementation((table: string) => {
        if (table === 'users') {
          // users.update().eq() chain
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        // org_members query (new org validation)
        if (table === 'org_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { org_id: 'org-123' }, error: null }),
              }),
            }),
          };
        }
        // user_profiles table - return the standard mock
        return mockDb;
      });

      // Mock fetching current keys from user_profiles
      mockDb.select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { api_keys: JSON.stringify({ openai: 'enc_old', anthropic: 'enc_anthropic_old' }) },
            error: null,
          }),
        }),
      });

      const result = await updateUserProfile(validData);

      expect(result).toEqual({ success: true });

      // Check encryption called for new key
      expect(encrypt).toHaveBeenCalledWith('sk-new-key');

      // Check upsert call for profile
      expect(mockDb.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          settings: expect.any(String),
          api_keys: expect.any(String),
          updated_at: expect.any(String),
        }),
      );

      expect(revalidatePath).toHaveBeenCalledWith('/settings');
    });

    it('should handle update error', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com', full_name: 'Test', role: 'user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      // Mock org_members to pass org check
      mockDb.from.mockImplementation((table: string) => {
        if (table === 'org_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { org_id: 'org-123' }, error: null }),
              }),
            }),
          };
        }
        return mockDb;
      });

      // Mock upsert to throw an error
      mockDb.upsert.mockRejectedValue(new Error('DB Error'));

      const result = await updateUserProfile(validData);

      expect(result).toEqual({ error: 'Failed to update profile' });
    });

    it('should return error if user has no org membership', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com', full_name: 'Test', role: 'user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      mockDb.from.mockImplementation((table: string) => {
        if (table === 'org_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
              }),
            }),
          };
        }
        return mockDb;
      });

      const result = await updateUserProfile(validData);
      expect(result).toEqual({ error: 'Forbidden: user is not a member of any organization' });
    });
  });
});
