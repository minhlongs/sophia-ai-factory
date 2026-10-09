'use server';

/**
 * Agency Tenant Server Actions Facade
 *
 * Provides transactional server actions for registering agency tenants,
 * binding custom/subdomains, issuing tenant API tokens, updating compute quotas,
 * and querying tenant audit logs.
 *
 * Layer: land (imports @/seed/*, @/tree/*; strictly zero imports from @/forest/*)
 * Preserves 100% backward compatibility for existing callers and test suites.
 *
 * @module land/agy/agency-tenant-actions
 */

export * from './tenant-actions';
