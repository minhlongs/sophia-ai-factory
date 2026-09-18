import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

describe('GET /api/internal/runpod-status', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      INTERNAL_API_SECRET: 'test-internal-secret-12345',
      RUNPOD_API_KEY: 'test-runpod-key',
      RUNPOD_ENDPOINT_ID: 'test-endpoint',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('rejects request without internal secret header', async () => {
    const req = new NextRequest('http://localhost:3000/api/internal/runpod-status?jobId=job-123');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('rejects request with wrong internal secret', async () => {
    const req = new NextRequest('http://localhost:3000/api/internal/runpod-status?jobId=job-123', {
      headers: { 'x-internal-secret': 'wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('rejects request with missing jobId', async () => {
    const req = new NextRequest('http://localhost:3000/api/internal/runpod-status', {
      headers: { 'x-internal-secret': 'test-internal-secret-12345' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toEqual({ error: 'jobId query param required' });
  });

  it('returns stub status when Runpod env vars are absent', async () => {
    delete process.env.RUNPOD_API_KEY;
    const req = new NextRequest('http://localhost:3000/api/internal/runpod-status?jobId=job-123', {
      headers: { 'x-internal-secret': 'test-internal-secret-12345' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      status: 'COMPLETED',
      output: { download_url: null },
      stub: true,
    });
  });

  it('proxies status from Runpod API on valid authenticated request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'job-123',
        status: 'COMPLETED',
        output: { download_url: 'https://cdn.example.com/video.mp4' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = new NextRequest('http://localhost:3000/api/internal/runpod-status?jobId=job-123', {
      headers: { 'x-internal-secret': 'test-internal-secret-12345' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { status?: string; output?: { download_url?: string } };
    expect(data.status).toBe('COMPLETED');
    expect(data.output?.download_url).toBe('https://cdn.example.com/video.mp4');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.runpod.io/v2/test-endpoint/status/job-123',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-runpod-key' },
      })
    );
  });
});
