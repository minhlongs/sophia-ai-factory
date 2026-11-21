import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  single: vi.fn(),
  eqCalls: [] as Array<[string, string]>,
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((col: string, val: string) => {
        mocks.eqCalls.push([col, val]);
        return builder;
      }),
      single: mocks.single,
    };
    return {
      from: vi.fn(() => builder),
    };
  }),
}));

import { GET } from './route';

const sampleScript = {
  title: 'Private Option A Script',
  scenes: [
    {
      scene_number: 1,
      visual_description: 'Clean studio hook',
      narration: 'Hook narration line.',
      duration_estimate: 5,
    },
    {
      scene_number: 2,
      visual_description: 'Product demo walkthrough',
      narration: 'CTA narration line.',
      duration_estimate: 10,
    },
  ],
  total_duration: 15,
};

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/campaigns/[id]/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eqCalls.length = 0;
  });

  it.each([
    ['Unauthorized', 'Bạn cần đăng nhập'],
    ['Invalid campaign ID', 'Mã chiến dịch không hợp lệ'],
    ['Campaign not found', 'Không tìm thấy chiến dịch'],
    ['Campaign is not completed and cannot be exported', 'Chiến dịch chưa hoàn tất nên chưa thể tải xuống'],
    ['Campaign script is not yet available for export', 'Kịch bản chiến dịch chưa sẵn sàng để tải xuống'],
    ['Failed to export campaign script', 'Không thể tải xuống kịch bản chiến dịch'],
  ])('preserves English and includes Vietnamese for %s', async (english, vietnamese) => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-a' });
    mocks.single.mockResolvedValue({ data: {
      id: 'camp-1', user_id: 'user-a', title: 'Script', status: 'completed',
      script_content: null,
    }, error: null });
    let id = 'camp-1';
    if (english === 'Unauthorized') mocks.getCurrentUser.mockResolvedValue(null);
    if (english === 'Invalid campaign ID') id = ' ';
    if (english === 'Campaign not found') mocks.single.mockResolvedValue({ data: null, error: null });
    if (english === 'Campaign is not completed and cannot be exported') {
      mocks.single.mockResolvedValue({ data: { status: 'queued' }, error: null });
    }
    if (english === 'Failed to export campaign script') {
      mocks.single.mockRejectedValue(new Error('Export unavailable'));
    }
    const res = await GET(makeRequest('https://example.com/api/campaigns/camp-1/export'), {
      params: Promise.resolve({ id }),
    });
    expect(await res.json()).toEqual({ error: `${english} / ${vietnamese}` });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns 401 when unauthenticated', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const res = await GET(
      makeRequest('https://sophia.example.com/api/campaigns/camp-1/export'),
      { params: Promise.resolve({ id: 'camp-1' }) },
    );

    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('enforces cross-tenant isolation (404 when User B requests User A campaign)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-b', email: 'b@example.com' });
    mocks.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const res = await GET(
      makeRequest('https://sophia.example.com/api/campaigns/camp-user-a/export'),
      { params: Promise.resolve({ id: 'camp-user-a' }) },
    );

    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.eqCalls).toContainEqual(['id', 'camp-user-a']);
    expect(mocks.eqCalls).toContainEqual(['user_id', 'user-b']);
  });

  it('returns 409 when script_content is missing or not yet generated', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    mocks.single.mockResolvedValue({
      data: {
        id: 'camp-pending',
        user_id: 'user-a',
        title: 'Pending Campaign',
        status: 'queued',
        script_content: null,
        video_url: null,
      },
      error: null,
    });

    const res = await GET(
      makeRequest('https://sophia.example.com/api/campaigns/camp-pending/export'),
      { params: Promise.resolve({ id: 'camp-pending' }) },
    );

    expect(res.status).toBe(409);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns 200 JSON export for persisted text-only campaign', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    mocks.single.mockResolvedValue({
      data: {
        id: 'camp-1',
        user_id: 'user-a',
        title: 'Option A Campaign',
        status: 'completed',
        script_content: JSON.stringify(sampleScript),
        video_url: null,
      },
      error: null,
    });

    const res = await GET(
      makeRequest('https://sophia.example.com/api/campaigns/camp-1/export'),
      { params: Promise.resolve({ id: 'camp-1' }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = await res.json();
    expect(body).toEqual({
      campaignId: 'camp-1',
      title: 'Option A Campaign',
      status: 'completed',
      deliveryMode: 'text_only',
      publicPublished: false,
      script: sampleScript,
    });
  });

  it('returns 200 Markdown attachment when ?format=markdown is requested', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    mocks.single.mockResolvedValue({
      data: {
        id: 'camp-1',
        user_id: 'user-a',
        title: 'Option A Campaign',
        status: 'completed',
        script_content: JSON.stringify(sampleScript),
        video_url: null,
      },
      error: null,
    });

    const res = await GET(
      makeRequest('https://sophia.example.com/api/campaigns/camp-1/export?format=markdown'),
      { params: Promise.resolve({ id: 'camp-1' }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="campaign-camp-1-script.md"',
    );
    expect(res.headers.get('cache-control')).toBe('private, no-store');

    const markdown = await res.text();
    expect(markdown).toContain('# Private Option A Script');
    expect(markdown).toContain('### Scene 1 (5s)');
    expect(markdown).toContain('Hook narration line.');
    expect(markdown).toContain('### Scene 2 (10s)');
    expect(markdown).toContain('CTA narration line.');
  });

  it('returns 409 when campaign status is not completed even if partial script_content exists', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    mocks.single.mockResolvedValue({
      data: {
        id: 'camp-failed',
        user_id: 'user-a',
        title: 'Failed Campaign',
        status: 'failed',
        script_content: JSON.stringify(sampleScript),
        video_url: null,
      },
      error: null,
    });

    const res = await GET(
      makeRequest('http://localhost/api/campaigns/camp-failed/export'),
      { params: Promise.resolve({ id: 'camp-failed' }) },
    );
    expect(res.status).toBe(409);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('skips malformed persisted scenes without crashing Markdown export', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-a' });
    mocks.single.mockResolvedValue({ data: {
      id: 'camp-1', user_id: 'user-a', title: 'Script', status: 'completed',
      script_content: JSON.stringify({ ...sampleScript, scenes: [null, 42, [], ...sampleScript.scenes] }),
      video_url: null,
    }, error: null });
    const res = await GET(makeRequest('https://example.com/api/campaigns/camp-1/export?format=markdown'),
      { params: Promise.resolve({ id: 'camp-1' }) });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Hook narration line.');
  });

  it('does not claim full-video publication state in JSON or Markdown', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-a' });
    mocks.single.mockResolvedValue({ data: {
      id: 'camp-1', user_id: 'user-a', title: 'Script', status: 'completed',
      script_content: JSON.stringify(sampleScript), video_url: 'https://example.com/video.mp4',
    }, error: null });
    const context = { params: Promise.resolve({ id: 'camp-1' }) };
    const json = await GET(makeRequest('https://example.com/api/campaigns/camp-1/export'), context);
    expect(await json.json()).toMatchObject({ publicPublished: null });
    const markdown = await GET(makeRequest('https://example.com/api/campaigns/camp-1/export?format=markdown'), context);
    expect(await markdown.text()).toContain('**Public Auto-Publish:** unknown');
  });

});
