/**
 * Tier-gating tests for commerce Server Actions against the real in-memory
 * D1 shim. Covers:
 *   - createProductAction / listCommerceProducts / updateCommerceProduct
 *   - FORBIDDEN for BASIC and PREMIUM users (commerce_catalog requires PREMIUM+)
 *   - ALLOWED for PREMIUM / ENTERPRISE / MASTER
 *   - NOT_AUTHENTICATED when no session exists
 *   - VALIDATION_ERROR for malformed input
 *
 * @module land/commerce/__tests__/tier-gating
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1, mockGetD1 } from '@/__tests__/integration/shared-d1-shim';

// Hoisted mocks so vi.mock factory bodies can reference them.
const { mockRequireWorkspaceAccess, mockGetCurrentUser, mockGetUserTier } = vi.hoisted(() => ({
  mockRequireWorkspaceAccess: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockGetUserTier: vi.fn(),
}));

// Mock the auth helper so we don't need a real session/DB for membership.
vi.mock('../actions/commerce-action-auth', () => ({
  requireWorkspaceAccess: mockRequireWorkspaceAccess,
}));
// Mock the session + tier lookup used by the action itself.
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));
vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: mockGetUserTier,
}));
// Mock the D1 binding used by product-catalog (real in-memory DB).
vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1: vi.fn(),
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createProductAction } from '../actions/create-product';
import { listCommerceProducts } from '../actions/list-products';
import { updateCommerceProduct } from '../actions/update-product';

const WORKSPACE = 'ws-1';
const mockUser = { id: 'user-001', email: 'ceo@test.com' };

function setupDb(seedProduct = false) {
  const raw = freshDb();
  raw.exec(
    `CREATE TABLE IF NOT EXISTS commerce_products (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      product_type TEXT NOT NULL DEFAULT 'digital',
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      asset_ref TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  );
  // Seed p-1 so updateCommerceProduct's ownership check passes.
  if (seedProduct) {
    raw
      .prepare(
        `INSERT INTO commerce_products
         (id, workspace_id, name, price_cents, created_at, updated_at)
         VALUES ('p-1', 'ws-1', 'Widget', 1000, 0, 0)`,
      )
      .run();
  }
  mockGetD1(makeD1(raw));
}

function allowAccess(tier: string) {
  mockRequireWorkspaceAccess.mockResolvedValue({
    ok: true,
    value: { id: mockUser.id, email: mockUser.email },
  });
  mockGetCurrentUser.mockResolvedValue(mockUser);
  mockGetUserTier.mockResolvedValue(tier);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createProductAction', () => {
  it('rejects unauthenticated users', async () => {
    mockRequireWorkspaceAccess.mockResolvedValue({ ok: true, value: mockUser });
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const result = await createProductAction({
      workspaceId: WORKSPACE,
      name: 'Widget',
      priceCents: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('rejects BASIC tier (commerce catalog requires PREMIUM+)', async () => {
    allowAccess('BASIC');
    const result = await createProductAction({
      workspaceId: WORKSPACE,
      name: 'Widget',
      priceCents: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('allows PREMIUM tier (has enable_commerce_catalog)', async () => {
    setupDb(true);
    allowAccess('PREMIUM');
    const result = await createProductAction({
      workspaceId: WORKSPACE,
      name: 'Widget',
      priceCents: 1000,
    });
    expect(result.ok).toBe(true);
  });

  it('allows ENTERPRISE and MASTER tier users', async () => {
    for (const tier of ['ENTERPRISE', 'MASTER'] as const) {
      setupDb(true);
      allowAccess(tier);
      const result = await createProductAction({
        workspaceId: WORKSPACE,
        name: 'Widget',
        priceCents: 1000,
      });
      expect(result.ok).toBe(true);
    }
  });

  it('returns VALIDATION_ERROR for missing workspaceId', async () => {
    allowAccess('PREMIUM');
    const result = await createProductAction({
      workspaceId: '',
      name: 'Widget',
      priceCents: 1000,
    } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects workspace access denial (cross-tenant / forbidden)', async () => {
    mockRequireWorkspaceAccess.mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'no access' },
    });
    const result = await createProductAction({
      workspaceId: WORKSPACE,
      name: 'Widget',
      priceCents: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});

describe('listCommerceProducts', () => {
  it('rejects unauthenticated users', async () => {
    mockRequireWorkspaceAccess.mockResolvedValue({ ok: true, value: mockUser });
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const result = await listCommerceProducts({ workspaceId: WORKSPACE });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('rejects BASIC tier (commerce catalog requires PREMIUM+)', async () => {
    allowAccess('BASIC');
    const result = await listCommerceProducts({ workspaceId: WORKSPACE });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('allows PREMIUM tier (has enable_commerce_catalog)', async () => {
    setupDb(true);
    allowAccess('PREMIUM');
    const result = await listCommerceProducts({ workspaceId: WORKSPACE });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].id).toBe('p-1');
    }
  });

  it('allows ENTERPRISE and MASTER', async () => {
    for (const tier of ['ENTERPRISE', 'MASTER'] as const) {
      setupDb(true);
      allowAccess(tier);
      const result = await listCommerceProducts({ workspaceId: WORKSPACE });
      expect(result.ok).toBe(true);
    }
  });

  it('returns VALIDATION_ERROR for empty workspaceId', async () => {
    allowAccess('PREMIUM');
    const result = await listCommerceProducts({ workspaceId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('updateCommerceProduct', () => {
  it('rejects unauthenticated users', async () => {
    mockRequireWorkspaceAccess.mockResolvedValue({ ok: true, value: mockUser });
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const result = await updateCommerceProduct({
      workspaceId: WORKSPACE,
      productId: 'p-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('rejects BASIC tier (commerce catalog requires PREMIUM+)', async () => {
    allowAccess('BASIC');
    const result = await updateCommerceProduct({
      workspaceId: WORKSPACE,
      productId: 'p-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('allows PREMIUM tier (has enable_commerce_catalog)', async () => {
    setupDb(true);
    allowAccess('PREMIUM');
    const result = await updateCommerceProduct({
      workspaceId: WORKSPACE,
      productId: 'p-1',
    });
    if (!result.ok) expect(result.error.code).not.toBe('FORBIDDEN');
  });

  it('allows ENTERPRISE and MASTER', async () => {
    for (const tier of ['ENTERPRISE', 'MASTER'] as const) {
      setupDb(true);
      allowAccess(tier);
      const result = await updateCommerceProduct({
        workspaceId: WORKSPACE,
        productId: 'p-1',
      });
      if (!result.ok) expect(result.error.code).not.toBe('FORBIDDEN');
    }
  });

  it('returns VALIDATION_ERROR for missing productId', async () => {
    allowAccess('PREMIUM');
    const result = await updateCommerceProduct({
      workspaceId: WORKSPACE,
      productId: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});