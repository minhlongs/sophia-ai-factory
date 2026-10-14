/**
 * License utilization data
 * Layer: seed/types
 */
export interface LicenseUtilization {
  licenseNonce: string;
  tier: string;
  usedCredits: number;
  limitCredit: number;
  percentage: number;
  expiresAt: number | null;
  overageCount?: number;
  billableCount?: number;
  overageCredits?: number;
}
