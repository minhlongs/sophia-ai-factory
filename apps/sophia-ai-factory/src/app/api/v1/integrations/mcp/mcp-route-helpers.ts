/**
 * Helpers for /api/v1/integrations/mcp route handler.
 *
 * @module app/api/v1/integrations/mcp/mcp-route-helpers
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveTenantMcpServers } from '@/land/openclaw/mcp-gateway';
import type { McpSettings, McpCustomServer } from '@/seed/tenant-settings/defaults';

export const DEFAULT_MCP_SETTINGS: McpSettings = {
  enabledServers: [],
  customEndpoints: [],
  customServers: [],
};

export function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch {
    return null;
  }
}

export function redactAuthValue(
  server: McpCustomServer,
): Omit<McpCustomServer, 'authValue'> & { authValue?: string } {
  return { ...server, authValue: server.authValue ? '[REDACTED]' : undefined };
}

export async function handleTest(
  _req: NextRequest,
  tenantId: string,
  db: D1Database,
  body: unknown,
): Promise<NextResponse> {
  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Body must contain { name }' }, { status: 400 });
  }

  const { name } = parsed.data;

  try {
    const servers = await resolveTenantMcpServers(db, tenantId);
    const client = servers.get(name);
    if (!client) {
      return NextResponse.json(
        { ok: false, error: `Server '${name}' not found or disabled` },
        { status: 404 },
      );
    }

    await client.call('ping', {});
    return NextResponse.json({ ok: true, name, status: 'reachable' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, name, error: msg }, { status: 200 });
  }
}
