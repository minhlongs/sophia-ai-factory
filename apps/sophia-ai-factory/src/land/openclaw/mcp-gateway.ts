/**
 * mcp-gateway.ts — MCP server gateway with whitelist + per-tenant custom server support.
 * Phase 12: OpenClaw Orchestrator primitive
 *
 * Whitelist (per CLAUDE.md / hard constraints):
 *   youtube, tiktok, supabase, claude-mem, pencil, cheetahclaws
 *
 * Per-tenant custom servers are stored (encrypted) in the 'mcp' settings namespace.
 * BANNED: polar (rejected per project CLAUDE.md and global rules)
 */

import type { TenantContext } from './with-tenant';
import { getOrDefault } from '@/seed/tenant-settings/registry';
import { decryptToken } from '@/tree/crypto/token-crypto';
import type { McpSettings } from '@/seed/tenant-settings/defaults';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export class MCPDeniedError extends Error {
  constructor(server: string) {
    super(`OpenClaw MCP gateway: server '${server}' is not in the whitelist or tenant registry`);
    this.name = 'MCPDeniedError';
  }
}

export class MCPCallError extends Error {
  constructor(server: string, method: string, cause: unknown) {
    super(`OpenClaw MCP gateway: ${server}.${method} failed: ${String(cause)}`);
    this.name = 'MCPCallError';
  }
}

/** Approved MCP server identifiers */
export const MCP_WHITELIST = new Set(['youtube', 'tiktok', 'supabase', 'claude-mem', 'pencil', 'cheetahclaws']);

export interface MCPCallOptions {
  /** If provided, inject tenantId into args */
  ctx?: TenantContext;
  /** Timeout ms — defaults to 10000 */
  timeoutMs?: number;
  /** D1 database — required when resolving tenant custom servers */
  db?: D1Database;
}

// MCP client registry — populated at runtime by actual MCP bindings
// For Cloudflare Workers, these come from the AI Gateway / MCP Tool binding.
export type MCPServerClient = {
  call: (method: string, args: Record<string, unknown>) => Promise<unknown>;
};

const _mcpRegistry = new Map<string, MCPServerClient>();

/**
 * Register an MCP server client at runtime.
 * Called by the worker entrypoint once MCP bindings are available.
 */
export function registerMCPServer(name: string, client: MCPServerClient): void {
  _mcpRegistry.set(name, client);
}

/**
 * Build an HTTP-based MCP client for a custom server with optional auth.
 * authValue is already decrypted before this is called.
 */
function buildHttpMCPClient(
  url: string,
  authType: 'none' | 'bearer' | 'header',
  authValue: string | undefined,
): MCPServerClient {
  return {
    async call(method: string, args: Record<string, unknown>): Promise<unknown> {
      if (!shouldAllowRequest('openrouter')) {
        throw new Error('Circuit open for openrouter — MCP call blocked');
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authType === 'bearer' && authValue) {
        headers['Authorization'] = `Bearer ${authValue}`;
      } else if (authType === 'header' && authValue) {
        headers['X-MCP-Auth'] = authValue;
      }

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ method, args }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        recordSuccess('openrouter');
        return res.json() as Promise<unknown>;
      } catch (err) {
        recordFailure('openrouter', classifyError(err));
        throw err;
      }
    },
  };
}

/**
 * Resolve tenant custom MCP servers from the 'mcp' settings namespace.
 * authValues are decrypted on load.
 */
export async function resolveTenantMcpServers(
  db: D1Database,
  tenantId: string,
): Promise<Map<string, MCPServerClient>> {
  const settings = await getOrDefault<McpSettings>(db, tenantId, 'mcp');
  const map = new Map<string, MCPServerClient>();

  for (const server of settings.customServers ?? []) {
    if (!server.enabled) continue;

    let authValue: string | undefined;
    if (server.authValue) {
      try {
        authValue = await decryptToken(server.authValue);
      } catch {
        authValue = server.authValue; // plaintext fallback (pre-encryption)
      }
    }

    map.set(server.name, buildHttpMCPClient(server.url, server.authType, authValue));
  }

  return map;
}

/**
 * Call an MCP server method through the gateway.
 *
 * Resolution order:
 * 1. Check MCP_WHITELIST → use registered client from _mcpRegistry
 * 2. If tenantId + db provided → resolve tenant custom servers
 * 3. Otherwise throw MCPDeniedError
 *
 * @param server  MCP server name
 * @param method  Method name on the server
 * @param args    Arguments to pass
 * @param opts    Gateway options (tenant context, timeout, db)
 */
export async function mcp(
  server: string,
  method: string,
  args: Record<string, unknown> = {},
  opts: MCPCallOptions = {},
): Promise<unknown> {
  // Inject tenant context
  const enrichedArgs: Record<string, unknown> = { ...args };
  if (opts.ctx?.tenantId) {
    enrichedArgs._tenantId = opts.ctx.tenantId;
  }

  let client: MCPServerClient | undefined;

  if (MCP_WHITELIST.has(server)) {
    client = _mcpRegistry.get(server);
    if (!client) {
      throw new MCPCallError(server, method, `MCP server '${server}' not registered`);
    }
  } else if (opts.db && opts.ctx?.tenantId) {
    // Try tenant custom server registry
    const tenantServers = await resolveTenantMcpServers(opts.db, opts.ctx.tenantId);
    client = tenantServers.get(server);
    if (!client) {
      throw new MCPDeniedError(server);
    }
  } else {
    throw new MCPDeniedError(server);
  }

  try {
    const timeoutMs = opts.timeoutMs ?? 10_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await client.call(method, enrichedArgs);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if (err instanceof MCPDeniedError) throw err;
    throw new MCPCallError(server, method, err);
  }
}

/** Test helper: register a mock MCP client */
export function _registerMockMCP(name: string, client: MCPServerClient): void {
  _mcpRegistry.set(name, client);
}

/** Test helper: clear MCP registry */
export function _clearMCPRegistry(): void {
  _mcpRegistry.clear();
}
