/**
 * @module auth
 * Barrel re-exports for seed/auth.
 *
 * Note: getD1Raw is exported from resolve-org-id.ts but is also in seed/db/client.
 * getD1Raw is excluded from this barrel — import from '@/seed/db/client' directly.
 * EnrichedJwtClaims is also in enriched-jwt-types.ts (type alias);
 * enriched-jwt re-exports it from there. enriched-jwt-types is the canonical source.
 * isJwtExpired is only in enriched-jwt.ts.
 */
export * from './account-lockout-hook';
export * from './better-auth-client';
export * from './better-auth-server';
export * from './enforce-ai-command-quota';
// enforce-tier-quota removed (was re-export from forest). Import from @/forest/auth/enforce-tier-quota directly.
export * from './enriched-jwt-billing';
export * from './enriched-jwt-entitlements';
// enriched-jwt excluded from wildcard — re-exports EnrichedJwtClaims from enriched-jwt-types.
// Selective re-exports: type aliases + value functions.
export type { FeatureLimit, EnrichedJwtPayload, EnrichedJwtClaims, LicenseContext } from './enriched-jwt';
export {
  getDefaultEntitlements,
  getLicenseContext,
  createEnrichedJwt,
  verifyEnrichedJwt,
  decodeEnrichedJwt,
  extractQuotaFromJwt,
  isJwtExpired,
  refreshJwtIfExpired,
} from './enriched-jwt';
// RBAC exports
export { hasPermission, getRolePermissions, ROLE_PERMISSIONS } from './rbac';
export type { OrgRole, Permission } from './rbac';
// better-auth-session excluded from wildcard — functions return User which clashes with seed/db/client and seed/types.
// Selective re-exports for non-User-returning functions only.
export { AuthSystemError, getSession } from './better-auth-session';
export * from './get-current-user-or-openclaw';
// get-tenant-context excluded — uses getD1Raw which conflicts with seed/db/client
export * from './is-user-admin';
export * from './jwt-nonce-storage';
export * from './jwt-nonce-tracker';
export * from './oauth-state-store';
export * from './openclaw-token';
export * from './require-admin';
export * from './require-master-tier';
export * from './reset-password-token';
// resolve-org-id excluded — getD1Raw clashes with seed/db/client
export * from './sign-cookie-value';
