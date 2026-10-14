/**
 * RFC 4180 CSV field escaping and header builder helpers for Usage Export.
 * @module land/usage-export/csv-escape-helpers
 */

/**
 * CSV field escaping options
 */
export interface EscapeOptions {
  /** Escape quotes by doubling them (RFC 4180) */
  doubleQuotes?: boolean;
  /** Wrap all fields in quotes */
  forceQuotes?: boolean;
}

/**
 * Escape a single CSV field according to RFC 4180
 */
export function escapeCSVField(
  field: unknown,
  options: EscapeOptions = { doubleQuotes: true, forceQuotes: false },
): string {
  if (field === null || field === undefined) {
    return '';
  }

  const value = String(field);

  const needsQuoting =
    options.forceQuotes ||
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r') ||
    value.startsWith(' ') ||
    value.endsWith(' ');

  if (needsQuoting) {
    const escapedValue = options.doubleQuotes
      ? value.replace(/"/g, '""')
      : value;
    return `"${escapedValue}"`;
  }

  return value;
}

/**
 * Build CSV header row from field names
 */
export function buildCSVHeader(fields: string[]): string {
  return fields
    .map((field) => escapeCSVField(field, { forceQuotes: false }))
    .join(',');
}
