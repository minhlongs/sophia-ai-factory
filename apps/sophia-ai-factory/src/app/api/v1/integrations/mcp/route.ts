/**
 * REST API for per-tenant MCP custom server registry.
 *
 * GET    /api/v1/integrations/mcp        — list servers (authValue REDACTED)
 * POST   /api/v1/integrations/mcp        — add / update a server (encrypts authValue)
 * DELETE /api/v1/integrations/mcp        — remove a server by name
 * POST   /api/v1/integrations/mcp/test   — healthcheck a server by name
 *
 * @module app/api/v1/integrations/mcp/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { get, set } from '@/lib/tenant-settings/registry';
import { encryptToken } from '@/lib/publishing/token-crypto';
import { resolveTenantMcpServers } from '@/lib/openclaw/mcp-gateway';
import { McpCustomServerSchema } from '@/lib/tenant-settings/namespace-validators';
import type { McpSettings, McpCustomServer } from '@/lib/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

const DEFAULT_MCP_SETTINGS: McpSettings = {
  enabledServers: [],
  customEndpoints: [],
  customServers: [],
};

function getD1(): D1Database | null {
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

function redactAuthValue(server: McpCustomServer): Omit<McpCustomServer, 'authValue'> & { authValue?: string } {
  return { ...server, authValue: server.authValue ? '[REDACTED]' : undefined };
}

/** GET — list all custom MCP servers for the tenant (authValues redacted) */
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const settings = (await get<McpSettings>(db, user.id, 'mcp')) ?? DEFAULT_MCP_SETTINGS;
  return NextResponse.json({
    servers: (settings.customServers ?? []).map(redactAuthValue),
  });
}

const AddServerSchema = McpCustomServerSchema;
const DeleteSchema = z.object({ name: z.string().min(1) });

/** POST — add or update a custom MCP server */
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);

  // Route to /test sub-action if present
  const url = req.nextUrl?.pathname ?? '';
  if (url.endsWith('/test')) {
    return handleTest(req, user.id, db, body);
  }

  const parsed = AddServerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const serverData = parsed.data;

  // Encrypt authValue before storing
  let encryptedAuthValue: string | undefined;
  if (serverData.authValue) {
    try {
      encryptedAuthValue = await encryptToken(serverData.authValue);
    } catch {
      return NextResponse.json({ error: 'Failed to encrypt auth value — check OAUTH_TOKEN_ENC_KEY' }, { status: 500 });
    }
  }

  const current = (await get<McpSettings>(db, user.id, 'mcp')) ?? DEFAULT_MCP_SETTINGS;
  const existing = current.customServers ?? [];
  const idx = existing.findIndex(s => s.name === serverData.name);

  const newServer: McpCustomServer = {
    ...serverData,
    authValue: encryptedAuthValue,
  };

  let updated: McpCustomServer[];
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = newServer;
  } else {
    if (existing.length >= 20) {
      return NextResponse.json({ error: 'Maximum 20 custom MCP servers allowed' }, { status: 400 });
    }
    updated = [...existing, newServer];
  }

  await set(db, user.id, 'mcp', { ...current, customServers: updated });
  logger.info('[integrations/mcp] server upserted', { userId: user.id, name: serverData.name });

  return NextResponse.json({ ok: true, name: serverData.name });
}

/** DELETE — remove a custom MCP server by name */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Body must contain { name }' }, { status: 400 });
  }

  const { name } = parsed.data;
  const current = (await get<McpSettings>(db, user.id, 'mcp')) ?? DEFAULT_MCP_SETTINGS;
  const filtered = (current.customServers ?? []).filter(s => s.name !== name);

  await set(db, user.id, 'mcp', { ...current, customServers: filtered });
  logger.info('[integrations/mcp] server deleted', { userId: user.id, name });

  return NextResponse.json({ ok: true, removed: name });
}

async function handleTest(
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
      return NextResponse.json({ ok: false, error: `Server '${name}' not found or disabled` }, { status: 404 });
    }

    await client.call('ping', {});
    return NextResponse.json({ ok: true, name, status: 'reachable' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, name, error: msg }, { status: 200 });
  }
}
