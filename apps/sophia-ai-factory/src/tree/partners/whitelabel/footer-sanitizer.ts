/**
 * Brand Footer HTML Sanitizer (Zero-DOM, SSR & Edge-safe).
 *
 * Layer: tree/partners/whitelabel
 *
 * @module tree/partners/whitelabel/footer-sanitizer
 */

const DANGEROUS_BLOCK_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'svg',
  'math',
  'template',
  'noscript',
  'applet',
  'canvas',
];

/**
 * Sanitizes agency footer HTML to prevent Stored XSS, script injection,
 * iframe breakouts, and inline event handlers, while preserving safe formatting.
 *
 * Edge & SSR safe (pure string regex transformation, zero DOM dependency).
 */
export function sanitizeFooterHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml || typeof rawHtml !== 'string') {
    return '';
  }

  // 0. Pre-sanitization: Strip null bytes, control characters, and malformed tag-split fragments (<scr<script>)
  let sanitized = rawHtml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  sanitized = sanitized.replace(/<[a-zA-Z0-9_-]+(?=<)/g, '');
  sanitized = sanitized.replace(/<[a-zA-Z0-9_-]+$/g, '');

  // 1. Remove dangerous blocks and their contents completely (<script>, <style>, <iframe>, <object>, etc.)
  // Loop up to 3 passes to prevent nested bypasses like <scr<script>ipt>
  let prev = '';
  let passes = 0;
  while (sanitized !== prev && passes < 3) {
    prev = sanitized;
    for (const tag of DANGEROUS_BLOCK_TAGS) {
      const blockRegex = new RegExp(`<${tag}[\\s\\S]*?(?:<\\/${tag}>|$)`, 'gi');
      sanitized = sanitized.replace(blockRegex, '');
      const standaloneRegex = new RegExp(`<\\/?${tag}[^>]*>`, 'gi');
      sanitized = sanitized.replace(standaloneRegex, '');
    }
    passes++;
  }

  // 2. Remove comments and CDATA blocks
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');
  sanitized = sanitized.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');

  // 3. Remove other dangerous/disallowed standalone tags
  sanitized = sanitized.replace(
    /<\/?(?:link|meta|base|input|button|select|textarea|frame|frameset)[\s\S]*?>/gi,
    '',
  );

  // 4. Strip all inline event handlers (onclick=..., onerror=..., etc.)
  sanitized = sanitized.replace(
    /(\s+)on[a-zA-Z0-9_-]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi,
    '$1',
  );
  sanitized = sanitized.replace(
    /([\/])on[a-zA-Z0-9_-]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi,
    '$1',
  );

  // 5. Neutralize dangerous URL schemes in href, src: javascript:, vbscript:, livescript:, data:
  sanitized = sanitized.replace(
    /(href|src)\s*=\s*(["'])\s*(?:j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t|v\s*b\s*s\s*c\s*r\s*i\s*p\s*t|l\s*i\s*v\s*e\s*s\s*c\s*r\s*i\s*p\s*t|d\s*a\s*t\s*a)\s*:[^"'>]*\2/gi,
    '$1="#"',
  );
  sanitized = sanitized.replace(
    /(href|src)\s*=\s*(?:j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t|v\s*b\s*s\s*c\s*r\s*i\s*p\s*t|l\s*i\s*v\s*e\s*s\s*c\s*r\s*i\s*p\s*t|d\s*a\s*t\s*a)\s*:[^\s>]+/gi,
    '$1="#"',
  );

  // 6. Post-sanitization defense-in-depth: Re-strip null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized.trim();
}
