/**
 * Per-tenant custom MCP server resolution and HTTP client builder for land/openclaw.
 * @module land/openclaw/openclaw-mcp-client
 */

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

export type MCPServerClient = {
  call: (method: string, args: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Build an HTTP-based MCP client for a custom server with optional auth.
 * authValue is already decrypted before this is called.
 */
export function buildHttpMCPClient(
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
