/**
 * Types for AGY Tenant Isolation Edge Middleware
 * @module forest/middleware/isolation/types
 */

import type {
  AgencyTenantContext,
  RateLimitCheckResult,
} from '@/seed/types/agy-multitenancy';

export interface AgyTenantIsolationResult {
  allowed: boolean;
  status: number;
  reason?: string;
  errorCode?: string;
  context?: Partial<AgencyTenantContext>;
  rateLimit?: RateLimitCheckResult;
}

export interface AgyIsolationOptions {
  requireToken?: boolean;
  requiredPermission?: string;
  defaultRpsLimit?: number;
  defaultQuotaMcu?: number;
  secret?: string;
  nowMs?: number;
}
