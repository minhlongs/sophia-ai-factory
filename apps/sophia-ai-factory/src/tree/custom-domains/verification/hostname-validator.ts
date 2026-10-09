/**
 * @file hostname-validator.ts
 * @description Validates Fully Qualified Domain Names (FQDN) for custom domains.
 * @layer tree
 */

import { success, failure, type Result } from '@/seed/types/result';
import type { CustomDomainError } from '@/seed/types/custom-domains';
import { HOSTNAME_REGEX, FORBIDDEN_DOMAINS } from './types';

export function validateHostname(hostname: string): Result<string, CustomDomainError> {
  const normalized = hostname.trim().toLowerCase();

  if (!normalized || normalized.length < 4 || normalized.length > 253) {
    return failure({
      code: 'INVALID_HOSTNAME',
      message: 'Hostname length must be between 4 and 253 characters',
    });
  }

  // Check forbidden/reserved platform domains first so reserved names like localhost fail with appropriate error
  for (const forbidden of FORBIDDEN_DOMAINS) {
    if (normalized === forbidden || normalized.endsWith(`.${forbidden}`)) {
      return failure({
        code: 'INVALID_HOSTNAME',
        message: 'Cannot register root platform domains or internal reserved hostnames',
      });
    }
  }

  if (!HOSTNAME_REGEX.test(normalized)) {
    return failure({
      code: 'INVALID_HOSTNAME',
      message: 'Invalid hostname format. Must be a valid Fully Qualified Domain Name (e.g., portal.myagency.com)',
    });
  }

  // Enforce TLD rules (at least 2 alphabetic characters, non-numeric)
  const tld = normalized.slice(normalized.lastIndexOf('.') + 1);
  if (tld.length < 2 || !/^[a-z]+$/i.test(tld)) {
    return failure({
      code: 'INVALID_HOSTNAME',
      message: 'Invalid hostname format. Must be a valid Fully Qualified Domain Name (e.g., portal.myagency.com)',
    });
  }

  return success(normalized);
}
