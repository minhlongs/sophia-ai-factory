export interface TenantIsolationResult {
  allowed: boolean;
  reason?: string;
  agencyId?: string;
  errorCode?: string;
}
