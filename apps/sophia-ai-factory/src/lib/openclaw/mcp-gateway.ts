/**
 * mcp-gateway.ts — MCP server gateway with whitelist + tenant context injection
 * Phase 12: OpenClaw Orchestrator primitive
 *
 * Whitelist (per CLAUDE.md / hard constraints):
 *   youtube, tiktok, supabase, claude-mem, pencil
 *
 * BANNED: polar (rejected per project CLAUDE.md and global rules)
 */

import type { TenantContext } from './with-tenant';

export class MCPDeniedError extends Error {
  constructor(server: string) {
    super(`OpenClaw MCP gateway: server '${server}' is not in the whitelist`);
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
export const MCP_WHITELIST = new Set(['youtube', 'tiktok', 'supabase', 'claude-mem', 'pencil']);

export interface MCPCallOptions {
  /** If provided, inject tenantId into args */
  ctx?: TenantContext;
  /** Timeout ms — defaults to 10000 */
  timeoutMs?: number;
}

// MCP client registry — populated at runtime by actual MCP bindings
// For Cloudflare Workers, these come from the AI Gateway / MCP Tool binding.
type MCPServerClient = {
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
 * Call an MCP server method through the gateway.
 *
 * @param server  MCP server name (must be whitelisted)
 * @param method  Method name on the server
 * @param args    Arguments to pass
 * @param opts    Gateway options (tenant context, timeout)
 */
export async function mcp(
  server: string,
  method: string,
  args: Record<string, unknown> = {},
  opts: MCPCallOptions = {},
): Promise<unknown> {
  if (!MCP_WHITELIST.has(server)) {
    throw new MCPDeniedError(server);
  }

  // Inject tenant context
  const enrichedArgs: Record<string, unknown> = { ...args };
  if (opts.ctx?.tenantId) {
    enrichedArgs._tenantId = opts.ctx.tenantId;
  }

  const client = _mcpRegistry.get(server);
  if (!client) {
    // Server not yet registered — return structured error for graceful handling
    throw new MCPCallError(server, method, `MCP server '${server}' not registered`);
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
