import type {
  SovereignZoneCode,
  SovereignDataZone,
  RegulatoryFramework,
  CrossBorderTransferPolicy,
} from '@/seed/types/sovereign-vault';
import { SOVEREIGN_ZONE_CONFIGS } from './types';

/**
 * Returns the primary and fallback Cloudflare R2 / storage region bindings for a zone.
 */
export function getStorageRegionForZone(zoneCode: SovereignZoneCode): {
  primary: string;
  fallback: string | null;
} {
  const config = SOVEREIGN_ZONE_CONFIGS[zoneCode] ?? SOVEREIGN_ZONE_CONFIGS.GLOBAL;
  return {
    primary: config.primaryStorageRegion,
    fallback: config.fallbackStorageRegion,
  };
}

/**
 * Normalizes a raw database row into the strongly typed SovereignDataZone interface.
 */
export function mapRowToSovereignDataZone(row: Record<string, unknown>): SovereignDataZone {
  return {
    id: String(row.id),
    zoneCode: row.zone_code as SovereignZoneCode,
    name: String(row.name),
    jurisdictionLegalName: String(row.jurisdiction_legal_name),
    regulatoryFramework: row.regulatory_framework as RegulatoryFramework,
    primaryStorageRegion: String(row.primary_storage_region),
    fallbackStorageRegion: row.fallback_storage_region ? String(row.fallback_storage_region) : null,
    crossBorderTransferPolicy: row.cross_border_transfer_policy as CrossBorderTransferPolicy,
    mandatoryCmek: Boolean(row.mandatory_cmek),
    retentionPeriodDays: Number(row.retention_period_days || 2555),
    auditRetentionDays: Number(row.audit_retention_days || 2555),
    isActive: Boolean(row.is_active),
    createdAt: Number(row.created_at || Date.now()),
    updatedAt: Number(row.updated_at || Date.now()),
  };
}
