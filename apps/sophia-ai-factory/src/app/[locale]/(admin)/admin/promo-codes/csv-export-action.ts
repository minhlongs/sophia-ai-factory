'use server';

/**
 * Server Action: export all promo codes as CSV.
 * Admin-only. Accepts optional filters, caps at 10k rows (DoS guard).
 * @module admin/promo-codes/csv-export-action
 */

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listAdminCodes } from '@/land/promo/promo-repo';
import type { PromoCodeRow } from '@/land/promo/promo-types';

const MAX_EXPORT_ROWS = 10_000;

const FilterSchema = z.object({
  status: z.enum(['active', 'disabled', 'expired']).optional(),
  appliesToTier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']).optional(),
  codePrefix: z.string().max(40).optional(),
});

type ExportFilters = z.infer<typeof FilterSchema>;

/**
 * Escape a value for CSV. Wraps in quotes and doubles internal quotes.
 * Also prefixes single-quote to defang Excel-formula characters at start of
 * cell (=, +, -, @, \t, \r). Without this, a `description` like
 * `=cmd|'/c calc'!A1` could execute arbitrary commands when CSV opened in
 * Excel. OWASP "CSV Injection" / CWE-1236.
 */
function escapeCsvField(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  const dangerous = /^[=+\-@\t\r]/.test(s);
  const body = (dangerous ? "'" : '') + s.replaceAll('"', '""');
  return `"${body}"`;
}

function buildExportCsv(rows: PromoCodeRow[]): string {
  const headers = [
    'code',
    'applies_to_tier',
    'status',
    'used_count',
    'max_uses',
    'valid_until_unix',
    'created_at_unix',
    'description',
  ].map(escapeCsvField).join(',');

  const lines = rows.map((r) =>
    [
      r.code,
      r.applies_to_tier ?? '',
      r.status,
      r.used_count,
      r.max_uses ?? '',
      r.valid_until ?? '',
      r.created_at,
      r.description ?? '',
    ]
      .map(escapeCsvField)
      .join(','),
  );

  return [headers, ...lines].join('\n');
}

export async function exportPromoCodesCsvAction(
  rawFilters: ExportFilters,
): Promise<{ csv: string; count: number }> {
  // Admin gate — inline pattern matching page.tsx
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect('/dashboard');
  }

  // Validate filters
  const parsed = FilterSchema.safeParse(rawFilters);
  const filters = parsed.success ? parsed.data : ({} as ExportFilters);

  // Fetch rows (DoS cap at MAX_EXPORT_ROWS)
  const rows = await listAdminCodes({
    status: filters.status,
    appliesToTier: filters.appliesToTier,
    limit: MAX_EXPORT_ROWS,
    offset: 0,
  });

  // Apply codePrefix filter client-side (listAdminCodes lacks prefix support)
  const filtered =
    filters.codePrefix && filters.codePrefix.trim().length > 0
      ? rows.filter((r) =>
          r.code.toUpperCase().includes(filters.codePrefix!.toUpperCase()),
        )
      : rows;

  const csv = buildExportCsv(filtered);
  return { csv, count: filtered.length };
}
