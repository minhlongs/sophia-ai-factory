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
import { get, set } from '@/seed/tenant-settings/registry';
import { encryptToken } from '@/tree/crypto/token-crypto';
import { McpCustomServerSchema } from '@/seed/tenant-settings/namespace-validators';
import type { McpSettings, McpCustomServer } from '@/seed/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { errorResponse } from '@/seed/api';
import {
  DEFAULT_MCP_SETTINGS,
  getD1,
  redactAuthValue,
  handleTest,
} from './mcp-route-helpers';

export const dynamic = 'force-dynamic';

/** GET — list all custom MCP servers for the tenant (authValues redacted) */
export const GET = withRateLimit(async function GET(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const settings = (await get<McpSettings>(db, user.id, 'mcp')) ?? DEFAULT_MCP_SETTINGS;
  return NextResponse.json({
    servers: (settings.customServers ?? []).map(redactAuthValue),
  });
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } });

const AddServerSchema = McpCustomServerSchema;
const DeleteSchema = z.object({ name: z.string().min(1) });

/** POST — add or update a custom MCP server */
export const POST = withRateLimit(async function POST(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = await req.json().catch(() => null);

  // Route to /test sub-action if present
  const url = req.nextUrl?.pathname ?? '';
  if (url.endsWith('/test')) {
    return handleTest(req, user.id, db, body);
  }

  const parsed = AddServerSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('Invalid request body', 'VALIDATION_ERROR', 400);
  }

  const serverData = parsed.data;

  // Encrypt authValue before storing
  let encryptedAuthValue: string | undefined;
  if (serverData.authValue) {
    try {
      encryptedAuthValue = await encryptToken(serverData.authValue);
    } catch {
      return errorResponse('Failed to encrypt credentials', 'ENCRYPTION_FAILED', 500);
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
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 20 } });

/** DELETE — remove a custom MCP server by name */
export const DELETE = withRateLimit(async function DELETE(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getD1();
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
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 20 } });
