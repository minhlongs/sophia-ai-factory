/**
 * Voices API Tests
 *
 * Covers:
 * - 401 unauthenticated requests
 * - 400 missing consent (POST)
 * - 200/201 happy path (POST + GET)
 * - 403 cross-tenant DELETE
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock getCurrentUser
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

// Mock DB
const mockDbChain = {
  from: vi.fn(),
};

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(() => mockDbChain),
}));

// Mock R2
vi.mock('@/land/video/r2-binding', () => ({
  getVideoBucket: vi.fn(),
  tenantScopedKey: vi.fn((t: string, j: string, s: string) => `tenants/${t}/videos/${j}/${s}`),
}));

vi.mock('@/land/video/r2-multipart-upload', () => ({
  uploadToR2: vi.fn().mockResolvedValue('tenants/t1/voices/v1/ref.wav'),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getVideoBucket } from '@/land/video/r2-binding';
import { createServerClient } from '@/seed/db/client';
import { POST, GET } from '../route';
import { DELETE } from '../[id]/route';

const mockUser = { id: 'user-1', tenantId: 'tenant-1', email: 'test@test.com' };

function buildChain(singleResult: Record<string, unknown>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue(singleResult),
    then: undefined as unknown,
  };
  // Ensure createServerClient returns something with from()
  vi.mocked(createServerClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServerClient>);
  mockDbChain.from.mockReturnValue(chain);
  return chain;
}

describe('POST /api/voices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore createServerClient after clearAllMocks
    vi.mocked(createServerClient).mockReturnValue({ from: vi.fn().mockReturnValue(mockDbChain) } as unknown as ReturnType<typeof createServerClient>);
    vi.mocked(getVideoBucket).mockResolvedValue({
      bucket: {
        put: vi.fn().mockResolvedValue(undefined),
        createMultipartUpload: vi.fn(),
      } as unknown as R2Bucket,
      publicBaseUrl: null,
    });
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/voices', { method: 'POST' });
    const resp = await POST(req);
    expect(resp.status).toBe(401);
  });

  it('returns 400 when consent is false', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof getCurrentUser>>);

    const formData = new FormData();
    formData.append('name', 'Test Voice');
    formData.append('language', 'en');
    formData.append('consent', 'false');
    formData.append('audio', new Blob([new ArrayBuffer(10)], { type: 'audio/wav' }), 'ref.wav');

    const req = new NextRequest('http://localhost/api/voices', {
      method: 'POST',
      body: formData,
    });
    vi.spyOn(req, 'formData').mockResolvedValue(formData);

    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json() as Record<string, unknown>;
    expect(body.error).toBeDefined();
  });

  it('returns 201 on happy path', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof getCurrentUser>>);

    const chain = buildChain({ data: null, error: null });
    chain.insert.mockResolvedValue({ data: null, error: null });

    const formData = new FormData();
    formData.append('name', 'Brand Voice');
    formData.append('language', 'en');
    formData.append('consent', 'true');
    formData.append('audio', new Blob([new ArrayBuffer(100)], { type: 'audio/wav' }), 'ref.wav');

    // NextRequest needs explicit content-type with boundary for formData() to work
    const req = new NextRequest('http://localhost/api/voices', {
      method: 'POST',
      body: formData,
      // NextRequest infers multipart boundary from FormData
    });
    // Spy formData() to return our controlled formData
    vi.spyOn(req, 'formData').mockResolvedValue(formData);

    const resp = await POST(req);
    const body = await resp.json() as { name?: string; error?: unknown };
    expect(resp.status).toBe(201);
    expect(body.name).toBe('Brand Voice');
  });
});

describe('GET /api/voices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServerClient).mockReturnValue({ from: vi.fn().mockReturnValue(mockDbChain) } as unknown as ReturnType<typeof createServerClient>);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const resp = await GET();
    expect(resp.status).toBe(401);
  });

  it('returns voices array on success', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof getCurrentUser>>);

    const voices = [{ id: 'v1', name: 'Brand', language: 'en', ref_audio_r2_key: 'k', created_at: 0 }];
    const chain = buildChain({ data: voices, error: null });
    // for list query, single() not used; mock order to return data
    chain.order.mockResolvedValue({ data: voices, error: null });

    const resp = await GET();
    expect(resp.status).toBe(200);
  });
});

describe('DELETE /api/voices/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServerClient).mockReturnValue({ from: vi.fn().mockReturnValue(mockDbChain) } as unknown as ReturnType<typeof createServerClient>);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/voices/v1', { method: 'DELETE' });
    const resp = await DELETE(req, { params: Promise.resolve({ id: 'v1' }) });
    expect(resp.status).toBe(401);
  });

  it('returns 403 on cross-tenant delete', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof getCurrentUser>>);

    // Voice belongs to different tenant
    const chain = buildChain({ data: { id: 'v1', tenant_id: 'OTHER-TENANT' }, error: null });
    void chain;

    const req = new NextRequest('http://localhost/api/voices/v1', { method: 'DELETE' });
    const resp = await DELETE(req, { params: Promise.resolve({ id: 'v1' }) });
    expect(resp.status).toBe(403);
  });

  it('returns 200 on valid delete', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof getCurrentUser>>);

    const chain = buildChain({ data: { id: 'v1', tenant_id: 'tenant-1' }, error: null });
    chain.delete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const req = new NextRequest('http://localhost/api/voices/v1', { method: 'DELETE' });
    const resp = await DELETE(req, { params: Promise.resolve({ id: 'v1' }) });
    expect(resp.status).toBe(200);
  });
});
