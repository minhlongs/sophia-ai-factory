/**
 * Admin Landing Pages API Route Tests — validates Zod validation + auth gating.
 *
 * Tests both the parent route (GET/POST list+create) and the [slug] route (GET/PUT/DELETE).
 *
 * Covers:
 * - GET /api/admin/landing-pages: unauthorized redirect, authorized success
 * - POST /api/admin/landing-pages: unauthorized, validation errors, create success
 * - GET /api/admin/landing-pages/[slug]: not found, found
 * - PUT /api/admin/landing-pages/[slug]: validation error, not found, update success
 * - DELETE /api/admin/landing-pages/[slug]: not found, delete success
 *
 * @module app/api/admin/landing-pages/route.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ── Hoisted mocks for repo functions ────────────────────────────────────
const { mockGetBySlug, mockListAll, mockCreate, mockUpdate, mockRemove } = vi.hoisted(() => ({
mockGetBySlug: vi.fn(),
mockListAll: vi.fn(),
mockCreate: vi.fn(),
mockUpdate: vi.fn(),
mockRemove: vi.fn(),
}));

// The route files import these functions directly. Wire the mock factory
// to the hoisted spies so vi.mocked(import(...)) works in test bodies.
vi.mock('@/seed/db/repositories/landing-pages-repo', () => ({
getBySlug: mockGetBySlug,
listAll: mockListAll,
create: mockCreate,
update: mockUpdate,
remove: mockRemove,
}));

const { mockRequireAdmin } = vi.hoisted(() => ({ mockRequireAdmin: vi.fn() }));
vi.mock('@/seed/auth/require-admin', () => ({
requireAdmin: mockRequireAdmin,
}));

const { mockRequireMasterTier } = vi.hoisted(() => ({ mockRequireMasterTier: vi.fn() }));
vi.mock('@/seed/auth/require-master-tier', () => ({
requireMasterTier: mockRequireMasterTier,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────────────────

function makeJsonRequest(url: string, method: string, body: unknown): NextRequest {
return new NextRequest(url, {
method,
headers: { 'Content-Type': 'application/json' },
body: body === undefined ? undefined : JSON.stringify(body),
});
}

function makeAdminRequest(url: string): NextRequest {
return new NextRequest(url, {
method: 'GET',
headers: { 'Content-Type': 'application/json' },
});
}

// ── Parent route: GET /api/admin/landing-pages ─────────────────────────

describe('GET /api/admin/landing-pages', () => {
beforeEach(() => {
vi.clearAllMocks();
mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' });
});

it('redirects when not authorized (requireAdmin returns NextResponse)', async () => {
mockRequireAdmin.mockResolvedValue(new NextRequest('http://localhost', { method: 'GET' }));
mockRequireAdmin.mockResolvedValue(new NextResponse(null, { status: 302 }));

const { GET } = await import('./route');
const res = await GET(makeAdminRequest('http://localhost/api/admin/landing-pages'));
expect(res.status).toBe(302);
});

it('returns 200 with page list when authorized', async () => {
mockRequireMasterTier.mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' });
mockListAll.mockResolvedValue([
{ id: 'real-estate', nicheLabel: 'Real Estate' },
{ id: 'e-commerce', nicheLabel: 'E-Commerce' },
]);

const { GET } = await import('./route');
const res = await GET(makeAdminRequest('http://localhost/api/admin/landing-pages'));
const body = await res.json() as Array<Record<string, unknown>>;

expect(res.status).toBe(200);
expect(body).toHaveLength(2);
expect(body[0].id).toBe('real-estate');
expect(mockListAll).toHaveBeenCalledOnce();
});
});

// ── Parent route: POST /api/admin/landing-pages ────────────────────────

describe('POST /api/admin/landing-pages', () => {
beforeEach(() => {
vi.clearAllMocks();
mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' });
});

it('redirects when not authorized', async () => {
mockRequireAdmin.mockResolvedValue(new NextResponse(null, { status: 302 }));

const { POST } = await import('./route');
const res = await POST(makeJsonRequest('http://localhost/api/admin/landing-pages', 'POST', {}));
expect(res.status).toBe(302);
});

it('returns 400 when request body is invalid (missing id)', async () => {
mockRequireMasterTier.mockResolvedValue({ id: 'admin-1' });

const { POST } = await import('./route');
const res = await POST(makeJsonRequest('http://localhost/api/admin/landing-pages', 'POST', { nicheLabel: 'Test' }));
expect(res.status).toBe(400);

const body = await res.json() as Record<string, unknown>;
expect(body.error).toBe('Validation failed');
});

it('returns 400 when request body is invalid (empty id)', async () => {
mockRequireMasterTier.mockResolvedValue({ id: 'admin-1' });

const { POST } = await import('./route');
const res = await POST(makeJsonRequest('http://localhost/api/admin/landing-pages', 'POST', { id: '', nicheLabel: 'Test' }));
expect(res.status).toBe(400);
});

it('returns 201 when page is created successfully', async () => {
mockRequireMasterTier.mockResolvedValue({ id: 'admin-1' });
mockCreate.mockResolvedValue({
id: 'new-niche',
nicheLabel: 'New Niche / Ngách Mới',
heroTitleEn: null,
heroTitleVi: null,
heroSubEn: null,
heroSubVi: null,
features: [],
faq: [],
metaTitleEn: null,
metaTitleVi: null,
metaDescEn: null,
metaDescVi: null,
isPublished: true,
createdAt: '2026-06-01T00:00:00.000Z',
updatedAt: '2026-06-01T00:00:00.000Z',
});

const { POST } = await import('./route');
const res = await POST(makeJsonRequest('http://localhost/api/admin/landing-pages', 'POST', {
id: 'new-niche',
nicheLabel: 'New Niche / Ngách Mới',
isPublished: true,
}));
expect(res.status).toBe(201);

const body = await res.json() as Record<string, unknown>;
expect(body.id).toBe('new-niche');
expect(mockCreate).toHaveBeenCalledOnce();
});
});

// ── [slug] route: DELETE ────────────────────────────────────────────────

describe('DELETE /api/admin/landing-pages/[slug]', () => {
beforeEach(() => {
vi.clearAllMocks();
mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' });
});

it('returns 404 when page does not exist', async () => {
mockRequireMasterTier.mockResolvedValue({ id: 'admin-1' });
mockRemove.mockResolvedValue(false);

const { DELETE } = await import('./[slug]/route');
const res = await DELETE(new NextRequest('http://localhost/api/admin/landing-pages/nonexistent'), { params: Promise.resolve({ slug: 'nonexistent' }) });
expect(res.status).toBe(404);

const body = await res.json() as Record<string, unknown>;
expect(body.error).toBe('Landing page not found');
});

it('returns 200 when page is deleted', async () => {
mockRequireMasterTier.mockResolvedValue({ id: 'admin-1' });
mockRemove.mockResolvedValue(true);

const { DELETE } = await import('./[slug]/route');
const res = await DELETE(new NextRequest('http://localhost/api/admin/landing-pages/real-estate'), { params: Promise.resolve({ slug: 'real-estate' }) });
expect(res.status).toBe(200);

const body = await res.json() as Record<string, unknown>;
expect(body.success).toBe(true);
expect(mockRemove).toHaveBeenCalledWith('real-estate');
});
});

// ── [slug] route: GET ───────────────────────────────────────────────────

describe('GET /api/admin/landing-pages/[slug]', () => {
beforeEach(() => {
vi.clearAllMocks();
mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' });
});

it('returns 404 when page not found', async () => {
mockRequireMasterTier.mockResolvedValue({ id: 'admin-1' });
mockGetBySlug.mockResolvedValue(null);

const { GET } = await import('./[slug]/route');
const res = await GET(new NextRequest('http://localhost/api/admin/landing-pages/nonexistent'), { params: Promise.resolve({ slug: 'nonexistent' }) });
expect(res.status).toBe(404);
});

it('returns 200 with page data', async () => {
mockRequireMasterTier.mockResolvedValue({ id: 'admin-1' });
mockGetBySlug.mockResolvedValue({
id: 'real-estate',
nicheLabel: 'Real Estate',
heroTitleEn: 'AI for Real Estate',
heroTitleVi: null,
heroSubEn: null,
heroSubVi: null,
features: [],
faq: [],
metaTitleEn: null,
metaTitleVi: null,
metaDescEn: null,
metaDescVi: null,
isPublished: true,
createdAt: '2026-06-01T00:00:00.000Z',
updatedAt: '2026-06-01T00:00:00.000Z',
});

const { GET } = await import('./[slug]/route');
const res = await GET(new NextRequest('http://localhost/api/admin/landing-pages/real-estate'), { params: Promise.resolve({ slug: 'real-estate' }) });
expect(res.status).toBe(200);

const body = await res.json() as Record<string, unknown>;
expect(body.id).toBe('real-estate');
expect(mockGetBySlug).toHaveBeenCalledWith('real-estate');
});
});

// ── [slug] route: PUT ───────────────────────────────────────────────────

describe('PUT /api/admin/landing-pages/[slug]', () => {
beforeEach(() => {
vi.clearAllMocks();
mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' });
});

it('returns 400 on validation failure', async () => {
mockRequireMasterTier.mockResolvedValue({ id: 'admin-1' });

const { PUT } = await import('./[slug]/route');
const res = await PUT(
makeJsonRequest('http://localhost/api/admin/landing-pages/real-estate', 'PUT', { nicheLabel: 123 }),
{ params: Promise.resolve({ slug: 'real-estate' }) },
);
expect(res.status).toBe(400);
});

it('returns 404 when page not found', async () => {
mockRequireMasterTier.mockResolvedValue({ id: 'admin-1' });
mockUpdate.mockResolvedValue(null);

const { PUT } = await import('./[slug]/route');
const res = await PUT(
makeJsonRequest('http://localhost/api/admin/landing-pages/nonexistent', 'PUT', { nicheLabel: 'New' }),
{ params: Promise.resolve({ slug: 'nonexistent' }) },
);
expect(res.status).toBe(404);
});

it('returns 200 on successful update', async () => {
mockRequireMasterTier.mockResolvedValue({ id: 'admin-1' });
mockUpdate.mockResolvedValue({
id: 'real-estate',
nicheLabel: 'Updated Label',
heroTitleEn: null,
heroTitleVi: null,
heroSubEn: null,
heroSubVi: null,
features: [],
faq: [],
metaTitleEn: null,
metaTitleVi: null,
metaDescEn: null,
metaDescVi: null,
isPublished: true,
createdAt: '2026-06-01T00:00:00.000Z',
updatedAt: '2026-06-02T00:00:00.000Z',
});

const { PUT } = await import('./[slug]/route');
const res = await PUT(
makeJsonRequest('http://localhost/api/admin/landing-pages/real-estate', 'PUT', { nicheLabel: 'Updated Label' }),
{ params: Promise.resolve({ slug: 'real-estate' }) },
);
expect(res.status).toBe(200);

const body = await res.json() as Record<string, unknown>;
expect(body.nicheLabel).toBe('Updated Label');
expect(mockUpdate).toHaveBeenCalledWith('real-estate', { nicheLabel: 'Updated Label' });
});
});
