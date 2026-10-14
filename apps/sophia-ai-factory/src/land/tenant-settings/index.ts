/**
 * Barrel export for the tenant-settings framework.
 * @module lib/tenant-settings
 */

export * from '@/seed/tenant-settings/types';
export * from './defaults';
export * as registry from './registry';
export { NAMESPACE_VALIDATORS, validatorFor } from './namespace-validators';
