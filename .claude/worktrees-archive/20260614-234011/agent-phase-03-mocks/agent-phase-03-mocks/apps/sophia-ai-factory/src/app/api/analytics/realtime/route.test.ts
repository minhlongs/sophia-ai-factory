/**
 * Realtime Analytics SSE Route Tests
 *
 * Tests for GET /api/analytics/realtime
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before importing route
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/land/analytics/rbac', () => ({
  checkAdmin: vi.fn(),
}));

vi.mock('@/land/analytics/realtime-snapshot', () => ({
  fetchRealtimeSnapshot: vi.fn(),
}));

vi.mock('@/land/analytics/sse-broadcaster', () => ({
  createSSEStream: vi.fn(),
}));

import { GET } from './route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { checkAdmin } from '@/land/analytics/rbac';
import { fetchRealtimeSnapshot } from '@/land/analytics/realtime-snapshot';
import { createSSEStream } from '@/land/analytics/sse-broadcaster';

const MOCK_SNAPSHOT = {
  timestamp: '2026-04-25T00:00:00.000Z',
  activeUsers: 5,
  campaignsLast1h: 3,
  apiCallsLast1h: 42,
  errorRateLast1h: 0.5,
  topTierDistribution: { BASIC: 10, PREMIUM: 5 },
};

const MOCK_ADMIN_USER = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
const MOCK_BASIC_USER = { id: 'user-1', email: 'user@example.com', role: 'user' };

describe('GET /api/analytics/realtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: createSSEStream returns a minimal ReadableStream stub
    vi.mocked(createSSEStream).mockReturnValue(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: snapshot\ndata: {}\n\n'));
          controller.close();
        },
      })
    );

    vi.mocked(fetchRealtimeSnapshot).mockResolvedValue(MOCK_SNAPSHOT);
  });

  describe('Authentication', () => {
    it('returns 401 for unauthenticated requests', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/analytics/realtime');
      const res = await GET(req);

      expect(res.status).toBe(401);
      const body = await res.json() as Record<string, string>;
      expect(body.error).toContain('authentication required');
    });

    it('returns JSON content-type for 401', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/analytics/realtime');
      const res = await GET(req);

      expect(res.headers.get('Content-Type')).toContain('application/json');
    });
  });

  describe('Authorization', () => {
    it('returns 403 for non-admin authenticated user', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(MOCK_BASIC_USER);
      vi.mocked(checkAdmin).mockResolvedValue(false);

      const req = new NextRequest('http://localhost:3000/api/analytics/realtime');
      const res = await GET(req);

      expect(res.status).toBe(403);
      const body = await res.json() as Record<string, string>;
      expect(body.error).toContain('admin access required');
    });

    it('calls checkAdmin with the authenticated user id', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(MOCK_BASIC_USER);
      vi.mocked(checkAdmin).mockResolvedValue(false);

      const req = new NextRequest('http://localhost:3000/api/analytics/realtime');
      await GET(req);

      expect(checkAdmin).toHaveBeenCalledWith(MOCK_BASIC_USER.id);
    });
  });

  describe('SSE Stream', () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(MOCK_ADMIN_USER);
      vi.mocked(checkAdmin).mockResolvedValue(true);
    });

    it('returns 200 for admin user', async () => {
      const req = new NextRequest('http://localhost:3000/api/analytics/realtime');
      const res = await GET(req);

      expect(res.status).toBe(200);
    });

    it('returns text/event-stream content-type header', async () => {
      const req = new NextRequest('http://localhost:3000/api/analytics/realtime');
      const res = await GET(req);

      expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('returns no-cache cache-control header', async () => {
      const req = new NextRequest('http://localhost:3000/api/analytics/realtime');
      const res = await GET(req);

      expect(res.headers.get('Cache-Control')).toContain('no-cache');
    });

    it('returns keep-alive connection header', async () => {
      const req = new NextRequest('http://localhost:3000/api/analytics/realtime');
      const res = await GET(req);

      expect(res.headers.get('Connection')).toBe('keep-alive');
    });

    it('calls createSSEStream with fetchRealtimeSnapshot', async () => {
      const req = new NextRequest('http://localhost:3000/api/analytics/realtime');
      await GET(req);

      expect(createSSEStream).toHaveBeenCalledWith(fetchRealtimeSnapshot);
    });

    it('does not call createSSEStream for unauthenticated users', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/analytics/realtime');
      await GET(req);

      expect(createSSEStream).not.toHaveBeenCalled();
    });

    it('does not call createSSEStream for non-admin users', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(MOCK_BASIC_USER);
      vi.mocked(checkAdmin).mockResolvedValue(false);

      const req = new NextRequest('http://localhost:3000/api/analytics/realtime');
      await GET(req);

      expect(createSSEStream).not.toHaveBeenCalled();
    });
  });
});

describe('SSE Broadcaster helpers', () => {
  it('formatSSEMessage produces valid SSE frame', async () => {
    const { formatSSEMessage } = await vi.importActual<
      typeof import('@/land/analytics/sse-broadcaster')
    >('@/land/analytics/sse-broadcaster');

    const frame = formatSSEMessage('snapshot', MOCK_SNAPSHOT);
    expect(frame).toMatch(/^event: snapshot\n/);
    expect(frame).toMatch(/data: \{[\s\S]*\}\n\n$/);
    expect(frame).toContain('"activeUsers":5');
  });
});
