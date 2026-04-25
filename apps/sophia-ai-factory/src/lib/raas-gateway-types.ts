/**
 * RaaS Gateway v2.0.0 — Shared types and interfaces
 *
 * Imported by raas-gateway-client.ts and consumers.
 * Must NOT import from raas-gateway-client.ts (prevents circular imports).
 */

export interface RaasGatewayConfig {
  baseURL: string; // 'https://raas.agencyos.network'
  apiKey: string;  // mk_ prefix format
  timeout: number; // Default 10000ms
}

export interface QuotaTrend {
  timestamp: number;
  used: number;
  limit: number;
  percentage: number;
}

export interface RaasUsageMetrics {
  apiCallVolume: number;
  activeLicenses: number;
  costPerTenant: Record<string, number>;
  quotaConsumption: QuotaTrend[];
  timestamp: number;
}

export interface BillingMetrics {
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  byTier: {
    tier: string;
    customers: number;
    revenue: number;
  }[];
  trend: {
    date: string;
    revenue: number;
  }[];
}

export interface LicenseUtilization {
  licenseNonce: string;
  tier: string;
  usedCredits: number;
  limitCredit: number;
  percentage: number;
  expiresAt: number | null;
}

/** Internal cache entry shape */
export interface CacheEntry {
  data: RaasUsageMetrics | BillingMetrics | LicenseUtilization[];
  expiresAt: number;
}
