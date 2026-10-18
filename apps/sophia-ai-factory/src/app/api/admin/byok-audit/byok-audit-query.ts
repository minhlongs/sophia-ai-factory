import { readJsonl, getAuditBucket } from '@/seed/utils/jsonl-append';
import { z } from 'zod';

export const byokAuditQuerySchema = z.object({
  tenantId: z.string().max(128).optional(),
  event: z
    .enum(['key.created', 'key.rotated', 'key.revoked', 'key.used', 'key.validation_failed'])
    .optional(),
  from: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ByokAuditQueryParams = z.infer<typeof byokAuditQuerySchema>;

export interface ByokAuditEvent extends Record<string, unknown> {
  ts: string;
  tenantId: string;
  event: string;
  provider: string;
  keyPrefix: string;
  metadata?: Record<string, unknown>;
}

function createAuditRecordFilter(event?: string, from?: number) {
  return (record: ByokAuditEvent): boolean => {
    if (event && record.event !== event) return false;
    if (from) {
      const recordTs = new Date(record.ts).getTime() / 1000;
      if (recordTs < from) return false;
    }
    return true;
  };
}

export async function queryByokAuditTrail(
  bucket: NonNullable<Awaited<ReturnType<typeof getAuditBucket>>>,
  params: ByokAuditQueryParams,
) {
  const { tenantId, event, from, limit, offset } = params;
  const filterFn = createAuditRecordFilter(event, from);

  let tenantForPath: string | undefined;
  if (tenantId && /^[a-zA-Z0-9\-_]{1,128}$/.test(tenantId)) {
    tenantForPath = tenantId;
  }

  if (tenantForPath) {
    const key = `audit/byok/${tenantForPath}.jsonl`;
    const result = await readJsonl<ByokAuditEvent>(bucket, key, filterFn, limit, offset);
    return {
      filters: { tenantId: tenantForPath, event: event ?? null, from },
      limit,
      offset,
      count: result.total,
      records: result.records,
    };
  }

  const allTenantPaths = [tenantForPath].filter(Boolean);
  const allRecords: ByokAuditEvent[] = [];
  let totalAllTenants = 0;

  if (allTenantPaths.length === 0 && !tenantId) {
    const listResult = await bucket.list({ prefix: 'audit/byok/' });
    for (const obj of listResult.objects) {
      const key = obj.key;
      if (!key.endsWith('.jsonl')) continue;

      const result = await readJsonl<ByokAuditEvent>(bucket, key, filterFn, limit, offset);
      allRecords.push(...result.records);
      totalAllTenants += result.total;
      if (allRecords.length >= limit) break;
    }

    const sorted = allRecords
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, limit);
    return {
      filters: { tenantId: null, event: event ?? null, from },
      limit,
      offset,
      count: totalAllTenants,
      records: sorted,
    };
  }

  const actualTenantId = tenantForPath ?? '';
  const key = `audit/byok/${actualTenantId}.jsonl`;
  const result = await readJsonl<ByokAuditEvent>(bucket, key, filterFn, limit, offset);
  return {
    filters: { tenantId: actualTenantId, event: event ?? null, from },
    limit,
    offset,
    count: result.total,
    records: result.records,
  };
}
