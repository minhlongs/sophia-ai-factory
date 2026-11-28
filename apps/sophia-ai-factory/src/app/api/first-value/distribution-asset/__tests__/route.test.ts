import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

const mockGetCurrentUser = vi.fn();
const mockVerifyCsrfToken = vi.fn();
const mockVerifyWorkspaceAccess = vi.fn();
const mockGetD1 = vi.fn();
const mockSaveApprovedMp4ForDistribution = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));
vi.mock('@/seed/security/csrf', () => ({
  verifyCsrfToken: (req: NextRequest) => mockVerifyCsrfToken(req),
  csrfForbiddenResponse: () => new Response(JSON.stringify({ error: 'CSRF forbidden' }), { status: 403 }),
}));
vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: (orgId: string, userId: string) => mockVerifyWorkspaceAccess(orgId, userId),
}));
vi.mock('@/seed/db/client', () => ({
  getD1: () => mockGetD1(),
}));
vi.mock('@/land/first-value/distribution-asset-bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/land/first-value/distribution-asset-bridge')>();
  return {
    ...actual,
    saveApprovedMp4ForDistribution: (...args: unknown[]) => mockSaveApprovedMp4ForDistribution(...args),
  };
});

import { POST } from '../route';

function makeMp4Bytes(size = 256): ArrayBuffer {
  const buf = new Uint8Array(size);
  buf[4] = 0x66;
  buf[5] = 0x74;
  buf[6] = 0x79;
  buf[7] = 0x70;
  return buf.buffer;
}

function makeRequest(headers: Record<string, string>, body?: BodyInit | null): NextRequest {
  return new NextRequest('https://sophia.local/api/first-value/distribution-asset', {
    method: 'POST',
    headers,
    body: body ?? undefined,
  });
}

describe('POST /api/first-value/distribution-asset', () => {
  const fakeD1 = {} as D1Database;
  const fakeR2 = {} as R2Bucket;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'u1@example.com' });
    mockVerifyCsrfToken.mockReturnValue(true);
    mockVerifyWorkspaceAccess.mockResolvedValue(true);
    mockGetD1.mockResolvedValue(fakeD1);
    (globalThis as Record<string, unknown>).__env__ = { MEDIA_BUCKET: fakeR2 };
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__env__;
  });

  it('returns 401 when unauthenticated and 403 when CSRF fails', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const r401 = await POST(makeRequest({}));
    expect(r401.status).toBe(401);

    mockVerifyCsrfToken.mockReturnValueOnce(false);
    const r403 = await POST(makeRequest({}));
    expect(r403.status).toBe(403);
  });

  it('returns 400 when workspace/artifact headers are missing and 413 when Content-Length exceeds cap', async () => {
    const r400 = await POST(makeRequest({}));
    expect(r400.status).toBe(400);

    const r413 = await POST(
      makeRequest({
        'x-sophia-org-id': 'org-alpha',
        'x-sophia-artifact-id': 'art-1',
        'content-length': String(30 * 1024 * 1024),
      }),
    );
    expect(r413.status).toBe(413);
  });

  it('returns 403 on cross-workspace access and 503 when MEDIA_BUCKET is absent (never falls back to BACKUPS_BUCKET)', async () => {
    mockVerifyWorkspaceAccess.mockResolvedValueOnce(false);
    const r403 = await POST(
      makeRequest({ 'x-sophia-org-id': 'org-beta', 'x-sophia-artifact-id': 'art-1' }, makeMp4Bytes()),
    );
    expect(r403.status).toBe(403);

    (globalThis as Record<string, unknown>).__env__ = { BACKUPS_BUCKET: fakeR2 };
    const r503 = await POST(
      makeRequest({ 'x-sophia-org-id': 'org-alpha', 'x-sophia-artifact-id': 'art-1' }, makeMp4Bytes()),
    );
    expect(r503.status).toBe(503);
  });

  it('returns 400 on empty or too-small body and 409 when bridge rejects unapproved revision', async () => {
    const rEmpty = await POST(
      makeRequest({ 'x-sophia-org-id': 'org-alpha', 'x-sophia-artifact-id': 'art-1' }, null),
    );
    expect(rEmpty.status).toBe(400);

    const rSmall = await POST(
      makeRequest({ 'x-sophia-org-id': 'org-alpha', 'x-sophia-artifact-id': 'art-1' }, new Uint8Array(16)),
    );
    expect(rSmall.status).toBe(400);

    mockSaveApprovedMp4ForDistribution.mockResolvedValueOnce({
      ok: false,
      status: 409,
      code: 'REVIEW_NOT_APPROVED',
      error: 'Review not approved',
    });
    const r409 = await POST(
      makeRequest({ 'x-sophia-org-id': 'org-alpha', 'x-sophia-artifact-id': 'art-1' }, makeMp4Bytes()),
    );
    expect(r409.status).toBe(409);
  });

  it('returns 201 on first upload and 200 on idempotent replay', async () => {
    mockSaveApprovedMp4ForDistribution.mockResolvedValueOnce({
      ok: true,
      videoId: 'vid_abc123',
      r2ObjectKey: 'private/distribution/org-alpha/user-1/art-1/v1-hash.mp4',
      sha256Hex: 'a'.repeat(64),
      byteSize: 256,
      idempotentReplay: false,
    });
    const r201 = await POST(
      makeRequest(
        { 'x-sophia-org-id': 'org-alpha', 'x-sophia-artifact-id': 'art-1', 'x-sophia-duration-sec': '37' },
        makeMp4Bytes(),
      ),
    );
    expect(r201.status).toBe(201);
    const json1 = (await r201.json()) as { videoId: string; idempotentReplay: boolean };
    expect(json1.videoId).toBe('vid_abc123');
    expect(json1.idempotentReplay).toBe(false);

    mockSaveApprovedMp4ForDistribution.mockResolvedValueOnce({
      ok: true,
      videoId: 'vid_abc123',
      r2ObjectKey: 'private/distribution/org-alpha/user-1/art-1/v1-hash.mp4',
      sha256Hex: 'a'.repeat(64),
      byteSize: 256,
      idempotentReplay: true,
    });
    const r200 = await POST(
      makeRequest(
        { 'x-sophia-org-id': 'org-alpha', 'x-sophia-artifact-id': 'art-1' },
        makeMp4Bytes(),
      ),
    );
    expect(r200.status).toBe(200);
  });
});
