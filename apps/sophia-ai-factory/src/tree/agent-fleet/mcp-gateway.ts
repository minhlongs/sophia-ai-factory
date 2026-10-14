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
import {
  MCPDeniedError,
  MCPCallError,
  resolveTenantMcpServers,
  type MCPServerClient,
} from './mcp-tenant-resolver';

export {
  MCPDeniedError,
  MCPCallError,
  resolveTenantMcpServers,
  type MCPServerClient,
} from './mcp-tenant-resolver';

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

const _mcpRegistry = new Map<string, MCPServerClient>();

/**
 * Register an MCP server client at runtime.
 * Called by the worker entrypoint once MCP bindings are available.
 */
export function registerMCPServer(name: string, client: MCPServerClient): void {
  _mcpRegistry.set(name, client);
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
