/**
 * Helpers for /api/v1/settings/[namespace] route handler.
 *
 * @module app/api/v1/settings/[namespace]/namespace-route-helpers
 */

import { NextResponse } from 'next/server';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { SETTINGS_NAMESPACES, SettingsValidationError } from '@/seed/tenant-settings/types';
import { validatorFor } from '@/seed/tenant-settings/namespace-validators';
import type { SettingsNamespace } from '@/seed/tenant-settings';
import { logger } from '@/seed/utils/logger-utility';

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

export async function enforceNamespaceGate(
  userId: string,
  namespace: SettingsNamespace,
): Promise<NextResponse | null> {
  if (namespace !== 'branding') return null;
  const gate = await enforceCommercialFeatureForUser(userId, 'white_label_agency_portal');
  if (!gate.ok) {
    return NextResponse.json(
      { error: 'FEATURE_LOCKED', message: gate.error.message },
      { status: 403 },
    );
  }
  return null;
}

export function handleSettingsError(namespace: string, method: string, err: unknown): NextResponse {
  if (err instanceof SettingsValidationError) {
    return NextResponse.json(
      { error: 'Validation failed', message: `Invalid ${namespace} settings payload` },
      { status: 422 },
    );
  }
  logger.error(`[settings/${namespace}] ${method} failed`, err instanceof Error ? err : undefined);
  return NextResponse.json({ error: 'Server error' }, { status: 500 });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function mergeValidator(
  namespace: SettingsNamespace,
): (v: unknown) => Record<string, unknown> {
  const parse = validatorFor(namespace);
  return (v: unknown) => {
    const parsed: unknown = parse(v);
    if (!isPlainObject(parsed)) {
      throw new SettingsValidationError(namespace, 'validated value must be an object');
    }
    return parsed;
  };
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
