/**
 * POST /api/v1/settings/import — bulk-import settings from a JSON payload.
 * Validates each namespace; skips unknown ones. Returns import count and errors.
 * @module app/api/v1/settings/import/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { set } from '@/lib/tenant-settings/registry';
import { SETTINGS_NAMESPACES, SettingsValidationError } from '@/lib/tenant-settings/types';
import type { SettingsNamespace } from '@/lib/tenant-settings/types';
import { validatorFor } from '@/lib/tenant-settings/namespace-validators';
import { logger } from '@/seed/utils/logger-utility';

export const runtime = 'edge';
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

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Body must be a JSON object keyed by namespace' },
      { status: 400 },
    );
  }

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const importErrors: Array<{ namespace: string; error: string }> = [];
  let imported = 0;

  for (const [ns, value] of Object.entries(body as Record<string, unknown>)) {
    if (!SETTINGS_NAMESPACES.includes(ns as SettingsNamespace)) {
      importErrors.push({ namespace: ns, error: 'Unknown namespace — skipped' });
      continue;
    }
    const namespace = ns as SettingsNamespace;
    try {
      await set(db, user.id, namespace, value, validatorFor(namespace));
      imported++;
    } catch (err) {
      const msg =
        err instanceof SettingsValidationError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unknown error';
      importErrors.push({ namespace, error: msg });
    }
  }

  logger.info('[settings/import] completed', {
    userId: user.id,
    imported,
    errors: importErrors.length,
  });

  return NextResponse.json({ imported, errors: importErrors });
}
