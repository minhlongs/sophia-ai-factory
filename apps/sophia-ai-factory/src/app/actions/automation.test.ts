import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateScript, renderVideo, getUserProjects } from './automation';
import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { revalidatePath } from 'next/cache';

// Mock dependencies
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const globalFetch = global.fetch = vi.fn();

describe('Automation Server Actions', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: undefined as ((resolve: (value: unknown) => void, reject: (reason: unknown) => void) => Promise<unknown>) | undefined,
  };

  const mockDb = {
    from: vi.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup mock return values
    mockDb.from.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.insert.mockReturnThis();
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.delete.mockReturnThis();
    mockQueryBuilder.eq.mockReturnThis();
    mockQueryBuilder.single.mockReturnThis();
    mockQueryBuilder.order.mockReturnThis();
    mockQueryBuilder.limit.mockReturnThis();

    // Reset then
    mockQueryBuilder.then = undefined;

    // Default getCurrentUser response
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    vi.mocked(createServerClient).mockReturnValue(mockDb as unknown as ReturnType<typeof createServerClient>);
    process.env.N8N_WEBHOOK_GENERATE_SCRIPT = 'http://n8n.test/generate';
    process.env.N8N_WEBHOOK_RENDER_VIDEO = 'http://n8n.test/render';
  });

  afterEach(() => {
    delete process.env.N8N_WEBHOOK_GENERATE_SCRIPT;
    delete process.env.N8N_WEBHOOK_RENDER_VIDEO;
  });

  describe('generateScript', () => {
    it('returns error if topic or audience is missing', async () => {
      // Mock authenticated user to bypass auth guard
      const mockUser = { id: 'user123', email: 'test@example.com', role: 'user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const formData = new FormData();
      formData.append('topic', '');

      const result = await generateScript(formData);
      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });

    it('creates draft and calls webhook on success', async () => {
      const formData = new FormData();
      formData.append('topic', 'Test Topic');
      formData.append('audience', 'Test Audience');

      const mockUser = { id: 'user123', email: 'test@example.com', role: 'user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      // Configure mockQueryBuilder: from().insert().select().single()
      mockQueryBuilder.single.mockResolvedValue({ data: { id: 'camp123' }, error: null });

      globalFetch.mockResolvedValue({ ok: true } as Response);

      const result = await generateScript(formData);

      expect(result.success).toBe(true);
      expect(result.scriptId).toBe('camp123');
      expect(mockDb.from).toHaveBeenCalledWith('campaigns');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        topic: 'Test Topic',
        status: 'draft',
        user_id: 'user123'
      }));
      expect(globalFetch).toHaveBeenCalledWith(
        'http://n8n.test/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"scriptId":"camp123"')
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    });

    it('handles database errors gracefully', async () => {
      const formData = new FormData();
      formData.append('topic', 'Test Topic');
      formData.append('audience', 'Test Audience');

      const mockUser = { id: 'user123', email: 'test@example.com', role: 'user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      // Configure mockQueryBuilder
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: new Error('DB error') });

      const result = await generateScript(formData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to initialize campaign');
    });
  });

  describe('renderVideo', () => {
    it('returns error if scriptId is missing', async () => {
      // Mock authenticated user
      const mockUser = { id: 'user123', email: 'test@example.com', role: 'user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      const result = await renderVideo('');
      expect(result.success).toBe(false);
    });

    it('updates status and calls webhook on success', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com', role: 'user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      // Mock the chain resolution: from().update().eq() -> await
      const successResponse = { data: { id: 'camp123' }, error: null };
      mockQueryBuilder.then = (resolve: any) => {
        resolve(successResponse);
        return Promise.resolve(successResponse);
      };

      globalFetch.mockResolvedValue({ ok: true } as Response);

      const result = await renderVideo('camp123');

      expect(result.success).toBe(true);
      expect(mockDb.from).toHaveBeenCalledWith('campaigns');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ status: 'processing_video' });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'camp123');
      expect(globalFetch).toHaveBeenCalledWith(
        'http://n8n.test/render',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"scriptId":"camp123"')
        })
      );
    });
  });

  describe('getUserProjects', () => {
    it('returns list of projects', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com', role: 'user' };
      const mockCampaigns = [{ id: '1' }, { id: '2' }];
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      // Configure mockQueryBuilder: from().select().eq().order() -> await
      mockQueryBuilder.then = (resolve: any) => {
        resolve({ data: mockCampaigns, error: null });
        return Promise.resolve({ data: mockCampaigns, error: null });
      };

      const result = await getUserProjects();
      expect(result).toEqual(mockCampaigns);
      expect(mockDb.from).toHaveBeenCalledWith('campaigns');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user123');
    });

    it('returns empty array on error', async () => {
      const mockUser = { id: 'user123', email: 'test@example.com', role: 'user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

      mockQueryBuilder.then = (resolve: any) => {
        resolve({ data: null, error: new Error('DB Error') });
        return Promise.resolve({ data: null, error: new Error('DB Error') });
      };

      const result = await getUserProjects();
      expect(result).toEqual([]);
    });
  });
});
