import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchWithRetry,
  getJsonWithRetry,
  extractShortSha,
  formatDuration,
} from './test-http-utils';

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should succeed on first try', async () => {
    const mockResponse = { ok: true, status: 200 } as Response;
    global.fetch = vi.fn().mockResolvedValue(mockResponse);
    const result = await fetchWithRetry('https://example.com');
    expect(result).toBe(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on network failure', async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ ok: true } as Response);
    const result = await fetchWithRetry('https://example.com');
    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should retry on 5xx error', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 502 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    const result = await fetchWithRetry('https://example.com');
    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should fail after max retries on persistent error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(fetchWithRetry('https://example.com', {}, 2))
      .rejects.toThrow('Network error');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('getJsonWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and parse JSON successfully', async () => {
    const testData = { shortSha: 'abc12345' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(testData),
      status: 200,
    } as Response);
    const result = await getJsonWithRetry<{ shortSha: string }>('https://example.com/api/version');
    expect(result.data).toEqual(testData);
    expect(result.status).toBe(200);
    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should propagate fetch errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(getJsonWithRetry('https://example.com'))
      .rejects.toThrow('Network error');
  });
});

describe('extractShortSha', () => {
  it('should extract shortSha from object', () => {
    expect(extractShortSha({ shortSha: 'abc12345' })).toBe('abc12345');
  });

  it('should return null if no shortSha', () => {
    expect(extractShortSha({})).toBeNull();
    expect(extractShortSha({ sha: 'abc12345' })).toBeNull();
  });

  it('should handle undefined shortSha', () => {
    expect(extractShortSha({ shortSha: undefined })).toBeNull();
  });

  it('should handle empty string shortSha', () => {
    expect(extractShortSha({ shortSha: '' })).toBeNull();
  });
});

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('should format seconds with two decimals', () => {
    expect(formatDuration(1000)).toBe('1.00s');
    expect(formatDuration(2500)).toBe('2.50s');
    expect(formatDuration(1500)).toBe('1.50s');
  });

  it('should handle zero', () => {
    expect(formatDuration(0)).toBe('0ms');
  });
});
