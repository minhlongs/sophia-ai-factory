/**
 * Handler: lead:export
 *
 * BYOK-aware bulk lead export via Apollo.io → CSV.
 * Falls back to a 5-row stub when no Apollo key is configured.
 *
 * Params:
 *   - niche: string       (required when BYOK live; default "technology" for stub)
 *   - max_rows: number    (default 100, hard-cap 500)
 *   - format: 'csv'       (only supported format in v1)
 */

import { z } from 'zod';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { apolloPeopleBulkSearch, type ApolloPerson } from '@/lib/apollo/apollo-client';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from './types';

// ---------------------------------------------------------------------------
// Params schema
// ---------------------------------------------------------------------------

const ExportParamsSchema = z.object({
  niche: z.string().min(2).max(120).default('technology'),
  max_rows: z.coerce.number().int().min(1).max(500).default(100),
  format: z.literal('csv').default('csv'),
});

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

const CSV_HEADERS = ['Name', 'Email', 'Company', 'Title', 'Domain', 'LinkedIn'];

/** RFC 4180 field escaping. Also prefixes formula-injection chars with single-quote. */
function escapeField(raw: string | null | undefined): string {
  const s = raw ?? '';
  // Prefix Excel/Sheets formula triggers to prevent injection
  const sanitized = /^[=+\-@]/.test(s) ? `'${s}` : s;
  // Wrap in quotes if field contains comma, double-quote, or newline
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

function buildCsvRow(fields: (string | null | undefined)[]): string {
  return fields.map(escapeField).join(',');
}

function personsToCsv(people: ApolloPerson[]): string {
  const header = CSV_HEADERS.join(',');
  const rows = people.map((p) =>
    buildCsvRow([
      p.name,
      p.email,
      p.organization?.name ?? null,
      p.title,
      p.organization?.primary_domain ?? null,
      p.linkedin_url,
    ]),
  );
  return [header, ...rows].join('\n');
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Stub fallback (5 rows, matches original shape)
// ---------------------------------------------------------------------------

const STUB_ROWS: string[][] = [
  CSV_HEADERS,
  ['Alex Smith', 'alex.smith@techflow.io', 'TechFlow Solutions', 'CEO', 'techflow.io', ''],
  ['Jordan Johnson', 'jordan.johnson@brightmind.co', 'BrightMind Agency', 'CMO', 'brightmind.co', ''],
  ['Morgan Williams', 'morgan.williams@nextgendigital.com', 'NextGen Digital', 'Head of Marketing', 'nextgendigital.com', ''],
  ['Taylor Brown', 'taylor.brown@peakperformance.io', 'Peak Performance Co', 'VP Sales', 'peakperformance.io', ''],
  ['Casey Jones', 'casey.jones@cloudbase.dev', 'CloudBase Systems', 'Founder', 'cloudbase.dev', ''],
];

function stubCsv(): string {
  return STUB_ROWS.map((r) => buildCsvRow(r)).join('\n');
}

// ---------------------------------------------------------------------------
// Error → friendly message
// ---------------------------------------------------------------------------

function friendlyError(err: unknown): string {
  const status = (err as { status?: number }).status;
  if (status === 401 || status === 403) return 'Invalid Apollo API key — please update it in Settings > BYOK';
  if (status === 429) return 'Apollo rate-limited — please try again later';
  const msg = err instanceof Error ? err.message : String(err);
  return `Apollo error: ${msg.slice(0, 200)}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const parsed = ExportParamsSchema.safeParse(ctx.params ?? {});
  if (!parsed.success) {
    return { ok: false, error: 'validation_error', data: { message: parsed.error.message } };
  }
  const { niche, max_rows, format } = parsed.data;

  const apiKey = await resolveUserApiKey(ctx.userId, 'apollo');

  if (!apiKey) {
    const csv = stubCsv();
    return {
      ok: true,
      data: {
        format,
        content: csv,
        row_count: STUB_ROWS.length - 1,
        filename: 'leads-export-stub.csv',
        is_stub: true,
        upgrade_path: 'Add an Apollo.io API key in Settings > BYOK to export real leads',
      },
    };
  }

  try {
    const people = await apolloPeopleBulkSearch(apiKey, { niche, maxRows: max_rows });
    const csv = personsToCsv(people);
    const tenantShort = ctx.userId.slice(0, 8);
    const filename = `leads-export-${tenantShort}-${isoDate()}.csv`;
    return {
      ok: true,
      data: {
        format,
        content: csv,
        row_count: people.length,
        filename,
        is_stub: false,
      },
    };
  } catch (err) {
    logger.warn('[lead:export] Apollo bulk search failed', {
      code: (err as { code?: string }).code,
    });
    return { ok: false, error: 'apollo_error', data: { message: friendlyError(err) } };
  }
}
