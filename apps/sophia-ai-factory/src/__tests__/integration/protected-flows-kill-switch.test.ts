/**
 * Affiliate kill switch — protected side-effect gate.
 *
 * Boundary: the production kill-switch store over the migration-derived
 * SQLite/D1-compatible schema and real AES-GCM encryption. These tests prove
 * durable write/read, cache reset, tenant isolation, and fail-closed unknown
 * state. The server-action authorization checks use the production action with
 * only auth/tenant resolution mocked; they do not prove a live Better Auth
 * cookie or Cloudflare KV replication.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSchemaDatabase, makeSchemaBoundD1, type SqliteDb } from './d1-schema-boundary';

const { mockGetCurrentUser, mockResolveOrgId, mockHasWorkspaceRole, mockGetD1 } = vi.hoisted(
  () => ({
    mockGetCurrentUser: vi.fn(),
    mockResolveOrgId: vi.fn(),
    mockHasWorkspaceRole: vi.fn(),
    mockGetD1: vi.fn(),
  })
);

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock('@/seed/auth/resolve-org-id', () => ({ resolveOrgId: mockResolveOrgId }));
vi.mock('@/seed/auth/workspace-access', () => ({ hasWorkspaceRole: mockHasWorkspaceRole }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1, createServerClient: vi.fn() }));
vi.mock('@/seed/inngest/client', () => ({ inngest: { send: vi.fn() } }));

import {
  getAffiliateKillSwitchState,
  resetKillSwitchInMemoryCache,
  setAffiliateKillSwitch,
} from '@/tree/affiliate/kill-switch/kill-switch-store';
import { setOpcWorkspaceKillSwitchAction } from '@/forest/actions/opc-readiness-actions';

describe('protected kill switch flow', () => {
  const userId = 'u_admin_1';
  const workspaceId = 'workspace_1';
  let db: SqliteDb;

  beforeEach(() => {
    vi.clearAllMocks();
    resetKillSwitchInMemoryCache();
    db = buildSchemaDatabase().db;
    mockGetD1.mockResolvedValue(makeSchemaBoundD1(db));
    mockGetCurrentUser.mockResolvedValue({ id: userId, email: 'admin@example.invalid' });
    mockResolveOrgId.mockResolvedValue(workspaceId);
    mockHasWorkspaceRole.mockResolvedValue(true);
    process.env.CREDENTIALS_MASTER_KEY = 'b'.repeat(64);
  });

  afterEach(() => {
    resetKillSwitchInMemoryCache();
    delete process.env.CREDENTIALS_MASTER_KEY;
  });

  it('writes encrypted state and reads it after the memory cache is cleared', async () => {
    await expect(setAffiliateKillSwitch(true, workspaceId, userId)).resolves.toBe(true);

    const row = db
      .prepare('SELECT encrypted_value, updated_by FROM platform_configs WHERE key = ?')
      .get(`affiliate_kill_switch_active:${workspaceId}`) as
      | { encrypted_value: string; updated_by: string }
      | undefined;
    expect(row?.encrypted_value).toMatch(/^aes-v1:/);
    expect(row?.encrypted_value).not.toContain('true');
    expect(row?.updated_by).toBe(userId);

    resetKillSwitchInMemoryCache();
    await expect(getAffiliateKillSwitchState(workspaceId)).resolves.toEqual({
      active: true,
      known: true,
    });
  });

  it('keeps tenant switches isolated after durable reads', async () => {
    await setAffiliateKillSwitch(true, 'tenant_a', userId);
    await setAffiliateKillSwitch(false, 'tenant_b', userId);
    resetKillSwitchInMemoryCache();

    await expect(getAffiliateKillSwitchState('tenant_a')).resolves.toEqual({
      active: true,
      known: true,
    });
    await expect(getAffiliateKillSwitchState('tenant_b')).resolves.toEqual({
      active: false,
      known: true,
    });
  });

  it('fails closed when D1 becomes unavailable after a cache reset', async () => {
    await setAffiliateKillSwitch(false, workspaceId, userId);
    resetKillSwitchInMemoryCache();
    mockGetD1.mockResolvedValue(null);

    const state = await getAffiliateKillSwitchState(workspaceId);
    expect(state.active).toBe(true);
    expect(state.known).toBe(false);
    expect(state.reason).toContain('PLATFORM_CONFIG_STORE_UNAVAILABLE');
  });

  it('does not report a failed durable write as success', async () => {
    mockGetD1.mockResolvedValue(null);
    await expect(setAffiliateKillSwitch(true, workspaceId, userId)).rejects.toThrow(
      'KILL_SWITCH_DURABLE_STORE_UNAVAILABLE'
    );

    resetKillSwitchInMemoryCache();
    const state = await getAffiliateKillSwitchState(workspaceId);
    expect(state).toMatchObject({ active: true, known: false });
  });

  it('uses the server-canonical workspace role instead of a client claim', async () => {
    mockHasWorkspaceRole.mockResolvedValue(false);
    const response = await setOpcWorkspaceKillSwitchAction({ active: false });

    expect(response).toEqual({
      success: false,
      error: 'Forbidden: Workspace Admin authorization required',
      code: 'FORBIDDEN',
    });
    expect(
      db.prepare('SELECT 1 FROM platform_configs WHERE key = ?').get(
        `affiliate_kill_switch_active:${workspaceId}`
      )
    ).toBeUndefined();
  });

  it('requires an authenticated session before it can mutate state', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await setOpcWorkspaceKillSwitchAction({ active: true });

    expect(response).toEqual({
      success: false,
      error: 'Unauthorized: authentication required',
      code: 'UNAUTHORIZED',
    });
    expect(mockResolveOrgId).not.toHaveBeenCalled();
  });

  it('surfaces a write failure as action failure, never success true', async () => {
    mockGetD1.mockResolvedValue(null);
    const response = await setOpcWorkspaceKillSwitchAction({ active: true });
    expect(response.success).toBe(false);
    expect(response.code).toBe('DB_UNAVAILABLE');
  });
});
