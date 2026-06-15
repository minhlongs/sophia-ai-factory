/**
 * Input Sanitization Utilities
 * Prevent XSS và injection attacks
 */

/**
 * Sanitize HTML string để remove potentially dangerous content
 * Note: React already escapes by default, nhưng function này cho raw HTML input
 */
export function sanitizeHtml(input: string): string {
  // Remove script tags
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: protocol (có thể chứa base64 encoded scripts)
  sanitized = sanitized.replace(/data:text\/html/gi, '');

  return sanitized;
}

/**
 * Sanitize user input for display
 * Escape HTML special characters
 */
export function escapeHtml(input: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return input.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Sanitize SQL input để prevent SQL injection
 * Note: Supabase client đã handle escaping, nhưng extra layer không hại
 */
export function sanitizeSql(input: string): string {
  // Remove SQL comment markers
  let sanitized = input.replace(/--/g, '');
  sanitized = sanitized.replace(/\/\*/g, '');
  sanitized = sanitized.replace(/\*\//g, '');

  // Remove semicolons (prevent multiple statements)
  sanitized = sanitized.replace(/;/g, '');

  return sanitized.trim();
}

/**
 * Validate và sanitize email address
 */
export function sanitizeEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmed = email.trim().toLowerCase();

  if (!emailRegex.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Validate và sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize filename để prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators
  let sanitized = filename.replace(/[\/\\]/g, '');

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\./g, '');

  return sanitized.trim();
}

/**
 * Validate và sanitize JSON input
 */
export function sanitizeJson<T>(input: string): T | null {
  try {
    const parsed = JSON.parse(input);
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Strip all HTML tags from input
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Validate và sanitize phone number
 */
export function sanitizePhoneNumber(phone: string): string | null {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // Phone number should be 10-15 digits
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return null;
  }

  return digitsOnly;
}
