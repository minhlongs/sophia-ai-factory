/**
 * HTML & RFC-4180 CSV Escaping and Currency Helpers
 * Layer: tree/partners
 *
 * @module tree/partners/export/escaping-utils
 */

/**
 * Escapes unsafe characters for HTML output to prevent XSS.
 */
export function escapeHtml(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes a cell value according to RFC-4180 rules.
 * - If value contains comma, quote, CRLF, or LF, enclose in double quotes.
 * - Double quotes inside value are replaced with two double quotes ("").
 */
export function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats integer cents into currency string e.g. $1,250.00
 */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}
