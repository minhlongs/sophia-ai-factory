/**
 * POST /api/v1/integrations/mcp/test — healthcheck a named tenant custom MCP server.
 * Body: { name: string }
 * @module app/api/v1/integrations/mcp/test/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { resolveTenantMcpServers } from '@/lib/openclaw/mcp-gateway';

export const dynamic = 'force-dynamic';

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

const BodySchema = z.object({ name: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Body must contain { name: string }' }, { status: 400 });
  }

  const { name } = parsed.data;

  try {
    const servers = await resolveTenantMcpServers(db, user.id);
    const client = servers.get(name);
    if (!client) {
      return NextResponse.json({ ok: false, error: `Server '${name}' not found or disabled` }, { status: 404 });
    }

    await client.call('ping', {});
    return NextResponse.json({ ok: true, name, status: 'reachable' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, name, error: msg });
  }
}
