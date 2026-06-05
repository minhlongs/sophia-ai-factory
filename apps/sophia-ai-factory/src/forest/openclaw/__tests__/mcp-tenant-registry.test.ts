/**
 * Tests for per-tenant MCP server registry (mcp-gateway + tenant-settings integration).
 * Uses FakeD1 backed by better-sqlite3.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mcp,
  MCPDeniedError,
  MCPCallError,
  resolveTenantMcpServers,
  _clearMCPRegistry,
} from '../mcp-gateway';
import { set } from '@/seed/tenant-settings/registry';
import { createFakeD1 } from '../../publishing/__tests__/fake-d1-sqlite';
import type { D1Database } from '@cloudflare/workers-types';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tenant_settings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    namespace TEXT NOT NULL,
    value TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(tenant_id, namespace)
  )`,
];

function makeDb() {
  return createFakeD1(SCHEMA) as unknown as D1Database;
}

const TENANT = 'tenant-mcp-test';

// Mock token-crypto to avoid needing OAUTH_TOKEN_ENC_KEY in tests
vi.mock('@/forest/publishing/token-crypto', () => ({
  encryptToken: vi.fn(async (val: string) => `encrypted:${val}`),
  decryptToken: vi.fn(async (val: string) =>
    val.startsWith('encrypted:') ? val.slice(10) : val,
  ),
}));

describe('resolveTenantMcpServers', () => {
  let db: D1Database;

  beforeEach(() => {
    db = makeDb();
    _clearMCPRegistry();
  });

  it('returns empty map when no custom servers configured', async () => {
    const servers = await resolveTenantMcpServers(db, TENANT);
    expect(servers.size).toBe(0);
  });

  it('returns enabled servers as MCPServerClient instances', async () => {
    await set(db, TENANT, 'mcp', {
      enabledServers: [],
      customEndpoints: [],
      customServers: [
        {
          name: 'my-analytics',
          url: 'https://analytics.example.com/mcp',
          authType: 'bearer',
          authValue: 'encrypted:secret-token',
          enabled: true,
        },
      ],
    });

    const servers = await resolveTenantMcpServers(db, TENANT);
    expect(servers.size).toBe(1);
    expect(servers.has('my-analytics')).toBe(true);
  });

  it('excludes disabled servers', async () => {
    await set(db, TENANT, 'mcp', {
      enabledServers: [],
      customEndpoints: [],
      customServers: [
        {
          name: 'disabled-server',
          url: 'https://disabled.example.com/mcp',
          authType: 'none',
          enabled: false,
        },
        {
          name: 'active-server',
          url: 'https://active.example.com/mcp',
          authType: 'none',
          enabled: true,
        },
      ],
    });

    const servers = await resolveTenantMcpServers(db, TENANT);
    expect(servers.has('disabled-server')).toBe(false);
    expect(servers.has('active-server')).toBe(true);
  });

  it('decrypts authValue on load', async () => {
    await set(db, TENANT, 'mcp', {
      enabledServers: [],
      customEndpoints: [],
      customServers: [
        {
          name: 'auth-server',
          url: 'https://auth.example.com/mcp',
          authType: 'bearer',
          authValue: 'encrypted:my-bearer-token',
          enabled: true,
        },
      ],
    });

    // Mock fetch to capture Authorization header
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: 'ok' }), { status: 200 }),
    );

    const servers = await resolveTenantMcpServers(db, TENANT);
    const client = servers.get('auth-server');
    await client?.call('ping', {});

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://auth.example.com/mcp',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-bearer-token' }),
      }),
    );
    fetchSpy.mockRestore();
  });
});

describe('mcp() with tenant custom server', () => {
  let db: D1Database;

  beforeEach(() => {
    db = makeDb();
    _clearMCPRegistry();
  });

  it('throws MCPDeniedError for unknown non-whitelisted server without db', async () => {
    await expect(mcp('custom-tool', 'method', {})).rejects.toThrow(MCPDeniedError);
  });

  it('allows calling tenant custom server via mcp() with db + ctx', async () => {
    await set(db, TENANT, 'mcp', {
      enabledServers: [],
      customEndpoints: [],
      customServers: [
        {
          name: 'my-tool',
          url: 'https://tool.example.com/mcp',
          authType: 'none',
          enabled: true,
        },
      ],
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: 'pong' }), { status: 200 }),
    );

    const result = await mcp(
      'my-tool',
      'ping',
      {},
      { db, ctx: { tenantId: TENANT } },
    );

    expect(result).toEqual({ result: 'pong' });
  });

  it('throws MCPCallError when custom server fetch fails', async () => {
    await set(db, TENANT, 'mcp', {
      enabledServers: [],
      customEndpoints: [],
      customServers: [
        {
          name: 'broken-tool',
          url: 'https://broken.example.com/mcp',
          authType: 'none',
          enabled: true,
        },
      ],
    });

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

    await expect(
      mcp('broken-tool', 'ping', {}, { db, ctx: { tenantId: TENANT } }),
    ).rejects.toThrow(MCPCallError);
  });
});
