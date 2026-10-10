/**
 * Agency Onboarding Checklist and Input Sanitization Helpers
 *
 * Layer: tree (Pure domain logic)
 * @module tree/agency/validator/checklist-validator
 */

import {
  RESERVED_SLUGS,
  SLUG_REGEX,
  HEX_COLOR_REGEX,
  DOMAIN_REGEX,
  type ValidationResult,
} from './types';

/**
 * Validates an agency slug string.
 */
export function validateAgencySlug(slug: string | null | undefined): ValidationResult {
  const errors: string[] = [];
  if (!slug || typeof slug !== 'string') {
    return { valid: false, errors: ['SLUG_REQUIRED'] };
  }

  const normalized = slug.trim().toLowerCase();
  if (normalized.length < 3) {
    errors.push('SLUG_TOO_SHORT');
  }
  if (normalized.length > 48) {
    errors.push('SLUG_TOO_LONG');
  }
  if (!SLUG_REGEX.test(normalized)) {
    errors.push('SLUG_INVALID_FORMAT');
  }
  if (RESERVED_SLUGS.has(normalized)) {
    errors.push('SLUG_RESERVED');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a color hex code (#RGB or #RRGGBB).
 */
export function validateHexColor(color: string | null | undefined, fallback = '#3b82f6'): string {
  if (!color || typeof color !== 'string') {
    return fallback;
  }
  const trimmed = color.trim();
  if (HEX_COLOR_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return fallback;
}

/**
 * Validates a custom domain (FQDN). Rejects protocol schemes, ports, and path separators.
 */
export function validateCustomDomain(domain: string | null | undefined): ValidationResult {
  if (!domain || typeof domain !== 'string' || domain.trim() === '') {
    return { valid: true, errors: [] }; // Optional
  }

  const errors: string[] = [];
  const normalized = domain.trim().toLowerCase();

  if (normalized.includes('://')) {
    errors.push('DOMAIN_CONTAINS_PROTOCOL');
  }
  if (normalized.includes('/') || normalized.includes('\\')) {
    errors.push('DOMAIN_CONTAINS_PATH');
  }
  if (normalized.includes(':')) {
    errors.push('DOMAIN_CONTAINS_PORT');
  }
  if (normalized.length > 253) {
    errors.push('DOMAIN_TOO_LONG');
  }
  if (!DOMAIN_REGEX.test(normalized)) {
    errors.push('DOMAIN_INVALID_FORMAT');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Rigorously sanitizes custom CSS to prevent XSS breakout attacks.
 */
export function sanitizeCustomCss(rawCss: string | null | undefined): string {
  if (!rawCss || typeof rawCss !== 'string') {
    return '';
  }

  return rawCss
    .replace(/<script[\s\S]*?<\/script>/gi, '') // Strip script tags and inner content
    .replace(/<style[\s\S]*?<\/style>/gi, '') // Strip style tags and inner content
    .replace(/<[^>]*>/g, '') // Strip any HTML tags
    .replace(/<!--[\s\S]*?-->/g, '') // Strip HTML comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Strip CSS comments
    .replace(/@import\s+[^;]+;?/gi, '') // Strip @import rules
    .replace(/expression\s*\([^)]*\)/gi, '') // Strip IE expressions
    .replace(/behavior\s*:[^;]+;?/gi, '') // Strip IE behavior
    .replace(/-moz-binding\s*:[^;]+;?/gi, '') // Strip Mozilla XBL bindings
    .replace(/javascript\s*:/gi, '') // Strip javascript: pseudo-protocol
    .replace(/vbscript\s*:/gi, '') // Strip vbscript: pseudo-protocol
    .replace(/data\s*:\s*text\/html/gi, '') // Strip data:text/html
    .trim();
}
