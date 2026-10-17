/**
 * Helpers for /api/v1/settings/[namespace] route handler.
 *
 * @module app/api/v1/settings/[namespace]/namespace-route-helpers
 */

import { NextResponse } from 'next/server';
import { SETTINGS_NAMESPACES } from '@/seed/tenant-settings/types';
import type { SettingsNamespace } from '@/seed/tenant-settings';

export type RouteCtx = { params: Promise<{ namespace: string }> };

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

export function resolveNamespace(raw: string): SettingsNamespace | null {
  return SETTINGS_NAMESPACES.includes(raw as SettingsNamespace)
    ? (raw as SettingsNamespace)
    : null;
}

export function validatePatchBody(
  body: unknown,
): { ok: true; rawObj: Record<string, unknown> } | { ok: false; response: NextResponse } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'PATCH body must be a plain object' }, { status: 400 }),
    };
  }

  // Reject non-string keys and deeply nested values to prevent
  // injection via malformed PATCH payloads (arrays, functions, circular refs).
  const rawObj = body as Record<string, unknown>;
  const keyCheck = Object.keys(rawObj).every(
    (k) => typeof k === 'string' && /^[a-zA-Z_]/.test(k),
  );
  if (!keyCheck) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'PATCH keys must be plain string identifiers starting with a letter' },
        { status: 400 },
      ),
    };
  }

  const maxDepth = (obj: unknown, d = 0): number => {
    if (d > 3 || typeof obj !== 'object' || obj === null) return d;
    return Math.max(
      0,
      ...Object.values(obj as Record<string, unknown>).map((v) => maxDepth(v, d + 1)),
    );
  };
  if (maxDepth(rawObj) > 3) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'PATCH body too deeply nested (max 3 levels)' },
        { status: 400 },
      ),
    };
  }

  return { ok: true, rawObj };
}
