/**
 * HTML Sanitizer & Entity Escaper
 *
 * @module tree/billing/invoices/escape-html
 */

/**
 * Escape HTML special characters to prevent Stored XSS injection.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
