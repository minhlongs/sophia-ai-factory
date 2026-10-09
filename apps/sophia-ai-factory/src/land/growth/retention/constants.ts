/**
 * Customer Retention Constants & Formatting Utilities.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/constants
 */

export const CHURN_HEALTH_THRESHOLD = 40;
export const WARNING_HEALTH_THRESHOLD = 70;
export const WINBACK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days anti-spam cooldown

/**
 * Escapes special HTML characters to prevent XSS / HTML injection in email templates.
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes Telegram Markdown control characters to prevent formatting breakage.
 */
export function escapeTelegramMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/([_*\[\]`\\])/g, '\\$1');
}

/**
 * Safely parses and bounds dates to prevent unhandled RangeError on invalid / extreme numbers.
 */
export function computeSafeLastActiveAt(
  rawLastActiveAt: string | null | undefined,
  daysSinceLastActive: number,
): string {
  if (rawLastActiveAt) {
    try {
      const d = new Date(rawLastActiveAt);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString();
      }
    } catch {
      // Fall through to days calculation
    }
  }

  if (
    Number.isFinite(daysSinceLastActive) &&
    daysSinceLastActive >= -36500 &&
    daysSinceLastActive <= 36500
  ) {
    try {
      const targetTime = Date.now() - daysSinceLastActive * 86400000;
      const d = new Date(targetTime);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString();
      }
    } catch {
      // Fall through to fallback
    }
  }

  return new Date().toISOString();
}
