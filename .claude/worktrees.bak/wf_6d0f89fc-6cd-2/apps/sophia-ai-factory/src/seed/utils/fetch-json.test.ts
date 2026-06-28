import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchJson } from './fetch-json';

describe('seed/utils/fetch-json', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('fetchJson', () => {
    it('fetches and parses JSON successfully', async () => {
      const mockData = { users: [{ id: 1, name: 'John' }] };
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
        text: () => Promise.resolve(''),
      } as any);

      const result = await fetchJson('https://api.example.com/users');

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/users', { credentials: 'include' });
    });

    it('throws on non-ok responses', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Not found' }),
        text: () => Promise.resolve('Not found'),
      } as any);

      await expect(fetchJson('https://api.example.com/missing')).rejects.toThrow(
        'HTTP 404'
      );
    });

    it('throws on network failure', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      await expect(fetchJson('https://api.example.com/data')).rejects.toThrow('Network error');
    });

    it('handles JSON parse errors', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
        text: () => Promise.resolve('invalid json'),
      } as any);

      await expect(fetchJson('https://api.example.com/bad-json')).rejects.toThrow('Invalid JSON');
    });

    it('handles null response body', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null),
      } as any);

      const result = await fetchJson('https://api.example.com/empty');
      expect(result).toBeNull();
    });

    it('handles array responses', async () => {
      const mockData = [{ id: 1 }, { id: 2 }];
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as any);

      const result = await fetchJson('https://api.example.com/list');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('includes credentials in fetch options', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as any);

      await fetchJson('https://api.example.com/test');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        { credentials: 'include' }
      );
    });
  });
});
