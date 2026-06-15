import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  resolveUserTier: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: mocks.resolveUserTier,
}));

import { GET, POST } from './route';

function makeGet(path = '/api/creative-studio/scripts/templates'): NextRequest {
  return new NextRequest(`https://sophia.agencyos.network${path}`);
}

function makePost(body: unknown): NextRequest {
  return new NextRequest('https://sophia.agencyos.network/api/creative-studio/scripts/templates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/creative-studio/scripts/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    mocks.resolveUserTier.mockResolvedValue('BASIC');
  });

  it('rejects invalid template category filters', async () => {
    const res = await GET(makeGet('/api/creative-studio/scripts/templates?category=bad'));
    const body = await res.json() as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid category');
  });

  it('rejects out-of-range script generation input', async () => {
    const res = await POST(makePost({
      templateId: 'welcome',
      topic: 'Launch topic',
      targetDuration: 10000,
      language: 'vi',
    }));
    const body = await res.json() as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid script input');
  });

  it('generates a deterministic template script for a valid authenticated user', async () => {
    const res = await POST(makePost({
      templateId: 'welcome',
      topic: 'Founder weekly update',
      brandName: 'Sophia',
      targetDuration: 60,
      tone: 'friendly',
      language: 'en',
    }));
    const body = await res.json() as {
      script: {
        templateId: string;
        topic: string;
        brandName: string;
        language: string;
        totalDurationSec: number;
        scenes: unknown[];
      };
    };

    expect(res.status).toBe(200);
    expect(body.script).toMatchObject({
      templateId: 'welcome',
      topic: 'Founder weekly update',
      brandName: 'Sophia',
      language: 'en',
    });
    expect(body.script.totalDurationSec).toBeGreaterThanOrEqual(58);
    expect(body.script.totalDurationSec).toBeLessThanOrEqual(62);
    expect(body.script.scenes).toHaveLength(4);
  });

  it('accepts a bounded custom tone from the advanced UI field', async () => {
    const res = await POST(makePost({
      templateId: 'welcome',
      topic: 'Founder weekly update',
      targetDuration: 30,
      tone: 'warm but concise founder voice',
      language: 'en',
    }));
    const body = await res.json() as { script: { tone: string } };

    expect(res.status).toBe(200);
    expect(body.script.tone).toBe('warm but concise founder voice');
  });

  it('treats blank optional brand and tone fields as omitted', async () => {
    const res = await POST(makePost({
      templateId: 'welcome',
      topic: 'Founder weekly update',
      brandName: '   ',
      tone: '',
      language: 'en',
    }));
    const body = await res.json() as { script: { brandName: string; tone: string } };

    expect(res.status).toBe(200);
    expect(body.script.brandName).toBe('Our Channel');
    expect(body.script.tone).toBe('friendly');
  });
});
