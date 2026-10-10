import type {
  SovereignZoneCode,
  RegulatoryFramework,
  CrossBorderTransferPolicy,
} from '@/seed/types/sovereign-vault';

export interface SovereignZoneConfig {
  zoneCode: SovereignZoneCode;
  name: string;
  jurisdictionLegalName: string;
  regulatoryFramework: RegulatoryFramework;
  primaryStorageRegion: string;
  fallbackStorageRegion: string | null;
  crossBorderTransferPolicy: CrossBorderTransferPolicy;
  mandatoryCmek: boolean;
  retentionPeriodDays: number;
  auditRetentionDays: number;
}

/** Canonical Zone Configurations matching D1 0300 Seed */
export const SOVEREIGN_ZONE_CONFIGS: Record<SovereignZoneCode, SovereignZoneConfig> = {
  EU: {
    zoneCode: 'EU',
    name: 'European Sovereign Data Zone',
    jurisdictionLegalName: 'European Economic Area (GDPR)',
    regulatoryFramework: 'EU_GDPR',
    primaryStorageRegion: 'weur',
    fallbackStorageRegion: 'eeur',
    crossBorderTransferPolicy: 'adequacy_only',
    mandatoryCmek: true,
    retentionPeriodDays: 2555, // 7 years standard
    auditRetentionDays: 2555,
  },
  VN: {
    zoneCode: 'VN',
    name: 'Vietnam Sovereign Residency Zone',
    jurisdictionLegalName: 'Socialist Republic of Vietnam (Decree 13 & CyberLaw)',
    regulatoryFramework: 'VN_PDPD',
    primaryStorageRegion: 'apac-vn',
    fallbackStorageRegion: 'apac-sg',
    crossBorderTransferPolicy: 'strictly_prohibited',
    mandatoryCmek: true,
    retentionPeriodDays: 3650, // 10 years per Tax Law 38 / Circular TT78
    auditRetentionDays: 3650,
  },
  APAC_SG: {
    zoneCode: 'APAC_SG',
    name: 'Singapore APRA/PDPA Zone',
    jurisdictionLegalName: 'Republic of Singapore (PDPA 2012)',
    regulatoryFramework: 'SG_PDPA',
    primaryStorageRegion: 'apac-sg',
    fallbackStorageRegion: 'apac-jp',
    crossBorderTransferPolicy: 'explicit_consent_scc',
    mandatoryCmek: false,
    retentionPeriodDays: 2555,
    auditRetentionDays: 2555,
  },
  APAC_JP: {
    zoneCode: 'APAC_JP',
    name: 'Japan Sovereign Privacy Zone',
    jurisdictionLegalName: 'Japan (Act on the Protection of Personal Information)',
    regulatoryFramework: 'JP_APPI',
    primaryStorageRegion: 'apac-jp',
    fallbackStorageRegion: 'apac-sg',
    crossBorderTransferPolicy: 'adequacy_only',
    mandatoryCmek: false,
    retentionPeriodDays: 2555,
    auditRetentionDays: 2555,
  },
  US: {
    zoneCode: 'US',
    name: 'United States Commercial & CCPA Zone',
    jurisdictionLegalName: 'United States of America (CCPA/CPRA)',
    regulatoryFramework: 'US_CCPA',
    primaryStorageRegion: 'wnam',
    fallbackStorageRegion: 'enam',
    crossBorderTransferPolicy: 'unrestricted',
    mandatoryCmek: false,
    retentionPeriodDays: 2555,
    auditRetentionDays: 2555,
  },
  GLOBAL: {
    zoneCode: 'GLOBAL',
    name: 'Global Cross-Regional Default Zone',
    jurisdictionLegalName: 'International Common Law',
    regulatoryFramework: 'MULTI_JURISDICTION',
    primaryStorageRegion: 'auto',
    fallbackStorageRegion: null,
    crossBorderTransferPolicy: 'unrestricted',
    mandatoryCmek: false,
    retentionPeriodDays: 2555,
    auditRetentionDays: 2555,
  },
};
