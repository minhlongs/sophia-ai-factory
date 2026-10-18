/**
 * CSV serialization and stub helpers for lead:export mission handler.
 * @module forest/leads/missions/lead-export-csv
 */

import type { ApolloPerson } from '@/tree/apollo/apollo-client';

export const CSV_HEADERS = ['Name', 'Email', 'Company', 'Title', 'Domain', 'LinkedIn'];

/** RFC 4180 field escaping. Also prefixes formula-injection chars with single-quote. */
export function escapeField(raw: string | null | undefined): string {
  const s = raw ?? '';
  // Prefix Excel/Sheets formula triggers to prevent injection
  const sanitized = /^[=+\-@]/.test(s) ? `'${s}` : s;
  // Wrap in quotes if field contains comma, double-quote, or newline
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export function buildCsvRow(fields: (string | null | undefined)[]): string {
  return fields.map(escapeField).join(',');
}

export function personsToCsv(people: ApolloPerson[]): string {
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

export function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const STUB_ROWS: string[][] = [
  CSV_HEADERS,
  ['Alex Smith', 'alex.smith@techflow.io', 'TechFlow Solutions', 'CEO', 'techflow.io', ''],
  ['Jordan Johnson', 'jordan.johnson@brightmind.co', 'BrightMind Agency', 'CMO', 'brightmind.co', ''],
  ['Morgan Williams', 'morgan.williams@nextgendigital.com', 'NextGen Digital', 'Head of Marketing', 'nextgendigital.com', ''],
  ['Taylor Brown', 'taylor.brown@peakperformance.io', 'Peak Performance Co', 'VP Sales', 'peakperformance.io', ''],
  ['Casey Jones', 'casey.jones@cloudbase.dev', 'CloudBase Systems', 'Founder', 'cloudbase.dev', ''],
];

export function stubCsv(): string {
  return STUB_ROWS.map((r) => buildCsvRow(r)).join('\n');
}

export function friendlyError(err: unknown): string {
  const status = (err as { status?: number }).status;
  if (status === 401 || status === 403) return 'Invalid Apollo API key — please update it in Settings > BYOK';
  if (status === 429) return 'Apollo rate-limited — please try again later';
  const msg = err instanceof Error ? err.message : String(err);
  return `Apollo error: ${msg.slice(0, 200)}`;
}
