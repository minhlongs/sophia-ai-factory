import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateScript, renderVideo, getUserProjects } from './automation';
import { airtable } from '@/lib/airtable';
import { revalidatePath } from 'next/cache';
import { ScriptRecord } from '@/types';

// Mock dependencies
vi.mock('@/lib/airtable', () => ({
  airtable: {
    scripts: {
      create: vi.fn(),
      list: vi.fn(),
      updateStatus: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const globalFetch = global.fetch = vi.fn();

describe('Automation Server Actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // console.error = vi.fn(); // Suppress error logs during tests
    process.env.N8N_WEBHOOK_GENERATE_SCRIPT = 'http://n8n.test/generate';
    process.env.N8N_WEBHOOK_RENDER_VIDEO = 'http://n8n.test/render';
  });

  afterEach(() => {
    delete process.env.N8N_WEBHOOK_GENERATE_SCRIPT;
    delete process.env.N8N_WEBHOOK_RENDER_VIDEO;
  });

  describe('generateScript', () => {
    it('returns error if topic or audience is missing', async () => {
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

      const mockRecord = { id: 'rec123', topic: 'Test Topic', status: 'draft' };
      vi.mocked(airtable.scripts.create).mockResolvedValue(mockRecord as unknown as ScriptRecord);
      globalFetch.mockResolvedValue({ ok: true } as Response);

      const result = await generateScript(formData);

      expect(result.success).toBe(true);
      expect(result.scriptId).toBe('rec123');
      expect(airtable.scripts.create).toHaveBeenCalledWith(expect.objectContaining({
        topic: 'Test Topic',
        status: 'draft'
      }));
      expect(globalFetch).toHaveBeenCalledWith(
        'http://n8n.test/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"scriptId":"rec123"')
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    });

    it('handles airtable errors gracefully', async () => {
      const formData = new FormData();
      formData.append('topic', 'Test Topic');
      formData.append('audience', 'Test Audience');

      vi.mocked(airtable.scripts.create).mockRejectedValue(new Error('Airtable error'));

      const result = await generateScript(formData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to start generation');
    });

    it('logs warning if webhook url is not set', async () => {
      delete process.env.N8N_WEBHOOK_GENERATE_SCRIPT;
      const formData = new FormData();
      formData.append('topic', 'Test Topic');
      formData.append('audience', 'Test Audience');

      const mockRecord = { id: 'rec123', topic: 'Test Topic', status: 'draft' };
      vi.mocked(airtable.scripts.create).mockResolvedValue(mockRecord as unknown as ScriptRecord);
      const consoleSpy = vi.spyOn(console, 'warn');

      const result = await generateScript(formData);

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('N8N_WEBHOOK_GENERATE_SCRIPT not set'));
      expect(globalFetch).not.toHaveBeenCalled();
    });
  });

  describe('renderVideo', () => {
    it('returns error if scriptId is missing', async () => {
      const result = await renderVideo('');
      expect(result.success).toBe(false);
    });

    it('updates status and calls webhook on success', async () => {
      vi.mocked(airtable.scripts.updateStatus).mockResolvedValue({ id: 'rec123', status: 'video_queued' } as unknown as ScriptRecord);
      globalFetch.mockResolvedValue({ ok: true } as Response);

      const result = await renderVideo('rec123');

      expect(result.success).toBe(true);
      expect(airtable.scripts.updateStatus).toHaveBeenCalledWith('rec123', 'video_queued');
      // Fetch is fire-and-forget, so we assume it was called if code path reached
      expect(globalFetch).toHaveBeenCalledWith(
        'http://n8n.test/render',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"scriptId":"rec123"')
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    });

    it('logs warning if webhook url is not set', async () => {
      delete process.env.N8N_WEBHOOK_RENDER_VIDEO;
      vi.mocked(airtable.scripts.updateStatus).mockResolvedValue({ id: 'rec123', status: 'video_queued' } as unknown as ScriptRecord);
      const consoleSpy = vi.spyOn(console, 'warn');

      const result = await renderVideo('rec123');

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('N8N_WEBHOOK_RENDER_VIDEO not set'));
      expect(globalFetch).not.toHaveBeenCalled();
    });

    it('logs error if webhook fetch fails', async () => {
      vi.mocked(airtable.scripts.updateStatus).mockResolvedValue({ id: 'rec123', status: 'video_queued' } as unknown as ScriptRecord);
      // Mock fetch to reject. Since it's fire and forget without await, we need to ensure the promise rejection is handled.
      // However, in the code: fetch(...).catch(...)
      // We can spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error');
      globalFetch.mockRejectedValue(new Error('Webhook failed'));

      const result = await renderVideo('rec123');

      expect(result.success).toBe(true);

      // Since it's not awaited, we might need to wait a tick?
      // But passing a rejected promise to fetch should trigger the catch immediately in microtask queue?
      // Actually, since we don't await the fetch in the code, we can't easily deterministicly check console.error unless we wait.
      // But in JSDOM/Node env with mocks, it might execute synchronously enough or we can wait.
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Webhook fetch error:', expect.any(Error));
    });

    it('handles errors gracefully', async () => {
      vi.mocked(airtable.scripts.updateStatus).mockRejectedValue(new Error('Update failed'));

      const result = await renderVideo('rec123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to start rendering');
    });
  });

  describe('getUserProjects', () => {
    it('returns list of projects', async () => {
      const mockProjects = [{ id: '1' }, { id: '2' }];
      vi.mocked(airtable.scripts.list).mockResolvedValue(mockProjects as unknown as ScriptRecord[]);

      const result = await getUserProjects();
      expect(result).toEqual(mockProjects);
    });

    it('returns empty array on error', async () => {
      vi.mocked(airtable.scripts.list).mockRejectedValue(new Error('Fetch failed'));

      const result = await getUserProjects();
      expect(result).toEqual([]);
    });
  });
});
