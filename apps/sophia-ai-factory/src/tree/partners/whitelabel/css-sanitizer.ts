/**
 * Brand Custom CSS Sanitizer.
 *
 * Layer: tree/partners/whitelabel
 *
 * @module tree/partners/whitelabel/css-sanitizer
 */

/**
 * Rigorously strips <script>, @import, url(javascript:...), CSS expressions,
 * HTML breakout tags, CSS comments, and malicious injection vectors from custom CSS.
 *
 * Sanitization Sequence:
 * 0. Pre-sanitization: Strip null bytes and control characters FIRST
 * 1. Remove HTML tags, script blocks, style tags, and CDATA
 * 2. Strip CSS block comments to prevent comment-splitting evasion
 * 3. Strip @import rules completely
 * 4. Strip @charset and @namespace
 * 5. Neutralize url(javascript:...), url(data:text...), etc.
 * 6. Strip inline javascript: or vbscript: declarations
 * 7. Strip dynamic CSS properties (expression, behavior, -moz-binding)
 * 8. Post-sanitization defense-in-depth: Re-strip null bytes and control characters
 */
export function sanitizeBrandCss(customCss: string | null | undefined): string {
  if (!customCss || typeof customCss !== 'string') {
    return '';
  }

  // 0. Pre-sanitization: Strip null bytes and control characters FIRST before any regex checks
  let sanitized = customCss.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 1. Remove full <script>...</script> blocks including content
  sanitized = sanitized.replace(/<script[\s\S]*?(?:<\/script>|$)/gi, '');

  // 2. Remove style tags (both opening and closing) to prevent breakout
  sanitized = sanitized.replace(/<\/?style[^>]*>/gi, '');

  // 3. Remove any remaining HTML tags (<html>, <body>, <iframe>, etc.), comments, CDATA
  sanitized = sanitized.replace(/<\/?(?:html|body|iframe|img|svg|object|embed|link|meta)[\s\S]*?>/gi, '');
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');
  sanitized = sanitized.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // 4. Strip CSS comments (/* ... */) before keyword checks
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, '');

  // 5. Strip @import rules completely (remote stylesheet injection)
  sanitized = sanitized.replace(/@import\s+(?:url\([^)]*\)|["'][^"']*["'])[^;]*;?/gi, '');
  sanitized = sanitized.replace(/@import[^;{}]+;?/gi, '');

  // 6. Strip @charset, @namespace
  sanitized = sanitized.replace(/@(?:charset|namespace)[^;]+;?/gi, '');

  // 7. Strip url(javascript:...), url(data:...), url(vbscript:...)
  sanitized = sanitized.replace(
    /url\s*\(\s*["']?\s*(?:javascript|vbscript|livescript|mocha|data\s*:\s*text)[\s\S]*?\)/gi,
    'none',
  );

  // 8. Strip inline javascript: or vbscript: anywhere in CSS declarations
  sanitized = sanitized.replace(/(?:javascript|vbscript|livescript)\s*:/gi, '');

  // 9. Strip IE expression(...) and behavior: properties
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, 'none');
  sanitized = sanitized.replace(/behavior\s*:[^;}]*/gi, '');
  sanitized = sanitized.replace(/-moz-binding\s*:[^;}]*/gi, '');

  // 10. Final defense-in-depth: Strip null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized.trim();
}
