/**
 * Temporary, fail-closed switch for Creator Marketplace V2.
 *
 * Keep this disabled until the production schema has been reconciled and the
 * operator has independently verified the release gates. There is intentionally
 * no environment override so deployment configuration cannot reopen the paths.
 */
export const CREATOR_MARKETPLACE_V2_ENABLED: boolean = false;

export const MARKETPLACE_TEMPORARILY_UNAVAILABLE =
  'MARKETPLACE_TEMPORARILY_UNAVAILABLE' as const;

export const MARKETPLACE_TEMPORARILY_UNAVAILABLE_MESSAGE =
  'Creator Marketplace is temporarily unavailable while database integrity is being verified.';

export function marketplaceTemporarilyUnavailableError() {
  return {
    code: MARKETPLACE_TEMPORARILY_UNAVAILABLE,
    message: MARKETPLACE_TEMPORARILY_UNAVAILABLE_MESSAGE,
  };
}
