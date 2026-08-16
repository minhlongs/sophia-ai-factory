/**
 * GET /api/admin/byok-audit
 *
 * Admin-only query for BYOK audit trail events.
 * Reads JSONL from R2 (AUDIT_BUCKET) and returns filtered, paginated events.
 *
 * Query params:
 *   tenantId (optional) — filter by tenant
 *   event   (optional) — filter by event type (key.created|key.rotated|...)
 *   from    (unix s)   — filter events after this timestamp
 *   limit   (1-500)    — max records to return (default 100)
 *   offset  (>=0)      — records to skip (default 0)
 *
 * GET /api/admin/byok-audit/health — check audit trail read/write health
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { readJsonl } from '@/seed/utils/jsonl-append';
import { getAuditBucket } from '@/seed/utils/jsonl-append';
import { logger } from '@/seed/utils/logger-utility';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  tenantId: z.string().max(128).optional(),
  event: z.enum(['key.created', 'key.rotated', 'key.revoked', 'key.used', 'key.validation_failed']).optional(),
  from: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

interface ByokAuditEvent extends Record<string, unknown> {
  ts: string;
  tenantId: string;
  event: string;
  provider: string;
  keyPrefix: string;
  metadata?: Record<string, unknown>;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { success, data, error } = querySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.format() },
        { status: 400 },
      );
    }

    const { tenantId, event, from, limit, offset } = data;

    const bucket = await getAuditBucket();
    if (!bucket) {
      return NextResponse.json({ error: 'Audit trail unavailable' }, { status: 503 });
    }

    let tenantForPath: string | undefined;
    if (tenantId && /^[a-zA-Z0-9\-_]{1,128}$/.test(tenantId)) {
      tenantForPath = tenantId;
    }

    if (tenantForPath) {
      const key = `audit/byok/${tenantForPath}.jsonl`;
      const result = await readJsonl<ByokAuditEvent>(
        bucket,
        key,
        (record: ByokAuditEvent) => {
          if (event && record.event !== event) return false;
          if (from) {
            const recordTs = new Date(record.ts).getTime() / 1000;
            if (recordTs < from) return false;
          }
          return true;
        },
        limit,
        offset,
      );
      return NextResponse.json({
        filters: { tenantId: tenantForPath, event: event ?? null, from },
        limit,
        offset,
        count: result.total,
        records: result.records,
      });
    }

    const allTenantPaths = [tenantForPath].filter(Boolean);
    const allRecords: ByokAuditEvent[] = [];
    let totalAllTenants = 0;

    if (allTenantPaths.length === 0 && !tenantId) {
      const listResult = await bucket.list({ prefix: 'audit/byok/' });
      for (const obj of listResult.objects) {
        const key = obj.key;
        if (!key.endsWith('.jsonl')) continue;

        const result = await readJsonl<ByokAuditEvent>(
          bucket,
          key,
          (record) => {
            if (event && record.event !== event) return false;
            if (from) {
              const recordTs = new Date(record.ts).getTime() / 1000;
              if (recordTs < from) return false;
            }
            return true;
          },
          limit,
          offset,
        );
        allRecords.push(...result.records);
        totalAllTenants += result.total;
        if (allRecords.length >= limit) break;
      }

      const sorted = allRecords
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
        .slice(0, limit);
      return NextResponse.json({
        filters: { tenantId: null, event: event ?? null, from },
        limit,
        offset,
        count: totalAllTenants,
        records: sorted,
      });
    }

    const actualTenantId = tenantForPath ?? '';
    const key = `audit/byok/${actualTenantId}.jsonl`;
    const result = await readJsonl<ByokAuditEvent>(
      bucket,
      key,
      (record) => {
        if (event && record.event !== event) return false;
        if (from) {
          const recordTs = new Date(record.ts).getTime() / 1000;
          if (recordTs < from) return false;
        }
        return true;
      },
      limit,
      offset,
    );
    return NextResponse.json({
      filters: { tenantId: actualTenantId, event: event ?? null, from },
      limit,
      offset,
      count: result.total,
      records: result.records,
    });
  } catch (err) {
    logger.warn('[admin/byok-audit] query failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Audit query failed' }, { status: 500 });
  }
}