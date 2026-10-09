/**
 * Hex Color & CSS URL Sanitizer.
 *
 * Layer: tree/partners/whitelabel
 *
 * @module tree/partners/whitelabel/color-validator
 */

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Validates a hex color string (#RRGGBB). Falls back to a safe color if invalid.
 */
export function validateHexColor(color: string | null | undefined, fallback: string): string {
  if (!color || typeof color !== 'string') {
    return fallback;
  }
  const trimmed = color.trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
}

/**
 * Sanitizes a URL for safe embedding inside CSS url("...").
 * Prevents CSS injection, url() breakouts, quotes, parens, and javascript: protocols.
 */
export function sanitizeUrlForCss(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }
  const trimmed = rawUrl.trim();

  // Reject any string containing quotes, parentheses, backslashes, angle brackets, semicolons, or control whitespace
  if (/["'()\\<>;\s\r\n]/.test(trimmed)) {
    return '';
  }

  // Reject javascript:, vbscript:, data: URIs
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    return '';
  }

  // Must start with https://, http://, or /
  if (!/^(https?:\/\/|\/)[^"'()\\<>;\s]+$/i.test(trimmed)) {
    return '';
  }

  return trimmed;
}
