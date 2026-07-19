// ── Agency Slug Validator ────────────────────────────────────────────────────
// Validates slugs for white-label agency branding URLs.

import type { Result } from '@/seed/types/result';
import { success, failure } from '@/seed/types/result';

export interface ValidationError {
  code: string;
  message: string;
}

const RESERVED_SLUGS = new Set(['www', 'api', 'admin', 'dashboard']);

export const AGENCY_SLUG_REGEX: RegExp = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateAgencySlug(
  slug: string,
  _reserved: Set<string> = RESERVED_SLUGS,
): Result<string, ValidationError> {
  // Length check
  if (slug.length < 3) {
    return failure({
      code: 'INVALID_SLUG_FORMAT',
      message: `Slug must be at least 3 characters (got ${slug.length})`,
    });
  }
  if (slug.length > 50) {
    return failure({
      code: 'INVALID_SLUG_FORMAT',
      message: `Slug must be at most 50 characters (got ${slug.length})`,
    });
  }

  // Format check
  if (!AGENCY_SLUG_REGEX.test(slug)) {
    return failure({
      code: 'INVALID_SLUG_FORMAT',
      message: `Slug "${slug}" contains invalid characters. Only lowercase letters, numbers, and single hyphens are allowed.`,
    });
  }

  // Reserved slug check
  if (_reserved.has(slug)) {
    return failure({
      code: 'RESERVED_SLUG',
      message: `Slug "${slug}" is reserved and cannot be used.`,
    });
  }

  return success(slug);
}
