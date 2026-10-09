/**
 * Partner Analytics Export Engine Types & Interfaces
 * Layer: tree/partners
 *
 * @module tree/partners/export/types
 */

export interface PartnerExportBranding {
  brandName?: string;
  agencyName?: string;
  logoUrl?: string | null;
  primaryColor?: string; // Hex color e.g. #06b6d4
  accentColor?: string; // Hex color e.g. #3b82f6
  supportUrl?: string | null;
  reportPeriod?: string; // e.g. "September 2026"
  footerText?: string | null;
  confidentialityNote?: string | null;
}

export interface SparklineOptions {
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
}
