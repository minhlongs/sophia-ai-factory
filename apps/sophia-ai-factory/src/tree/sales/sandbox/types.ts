/**
 * Sandbox Provisioner Types & Options
 * Layer: tree/sales/sandbox
 */

export const DEFAULT_DEMO_MCU = 1000;
export const DEFAULT_EXPIRY_DAYS = 14;
export const DEFAULT_SECRET = process.env.SANDBOX_HMAC_SECRET || 'sophia-enterprise-demo-secret-key-2026';
export const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

export interface ProvisionDemoSandboxOptions {
  hostAgencyOrgId?: string;
  demoMcu?: number;
  expiryDays?: number;
  secret?: string;
  baseUrl?: string;
}
