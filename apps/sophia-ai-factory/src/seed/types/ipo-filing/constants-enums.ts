/**
 * @file constants-enums.ts
 * @description Canonical constants, scale targets, and enumeration types for IPO filing and SOX-404.
 * @layer seed
 */

// ============================================================================
// Canonical Constants & Targets
// ============================================================================

export const GATE10_SCALE_TARGETS = {
  MRR_CENTS: 500_000_000,         // $5,000,000.00
  ARR_CENTS: 6_000_000_000,       // $60,000,000.00
  TOTAL_CUSTOMERS: 20_000,        // 20,000 paid subscribers
  ARPU_CENTS: 25_000,             // $250.00
  MIN_NRR_PCT: 140.0,             // >= 140% Net Revenue Retention
  MIN_MAGIC_NUMBER: 1.5,          // > 1.5 Sales Efficiency
  MIN_RULE_OF_40_PCT: 65.0,       // >= 65% Growth + FCF Margin
  TARGET_EXCHANGES: ['NASDAQ', 'SGX'] as const,
} as const;

export const CANONICAL_ENTITIES = {
  US_INC: 'SOPHIA_GLOBAL_INC',
  SG_PTE_LTD: 'SOPHIA_SG_PTE_LTD',
  VN_CO_LTD: 'SOPHIA_VN_CO_LTD',
  CONSOLIDATED: 'CONSOLIDATED_GROUP',
} as const;

export const SOX_CONTROL_IDS = {
  SOD: 'SOX-FIN-01',
  INTERCOMPANY: 'SOX-FIN-02',
  ASC606_REVENUE: 'SOX-FIN-03',
  CRYPTO_INTEGRITY: 'SOX-ITGC-01',
  QUARANTINE_ADJUSTMENT: 'SOX-ITGC-02',
  REG_G_NON_GAAP: 'SOX-SEC-01',
} as const;

// ============================================================================
// Enumerations & Domain Unions
// ============================================================================

export type FilingType = 'S-1' | 'F-1' | '10-K' | '10-Q' | 'DUAL_LISTING';

export type FilingStatus =
  | 'draft'
  | 'review_pending'
  | 'sox_certified'
  | 'board_approved'
  | 'sec_submitted'
  | 'effective'
  | 'archived';

export type Sox404Status =
  | 'untested'
  | 'in_progress'
  | 'certified_clean'
  | 'qualified_deficiency'
  | 'adverse_weakness';

export type SoxControlCategory =
  | 'ENTITY_LEVEL'
  | 'ITGC'
  | 'FINANCIAL_REPORTING'
  | 'SEGREGATION_OF_DUTIES'
  | 'REVENUE_ASSURANCE'
  | 'ACCESS_CONTROL';

export type CosoFrameworkPillar =
  | 'CONTROL_ENVIRONMENT'
  | 'RISK_ASSESSMENT'
  | 'CONTROL_ACTIVITIES'
  | 'INFORMATION_COMMUNICATION'
  | 'MONITORING_ACTIVITIES';

export type AssertionTested =
  | 'EXISTENCE'
  | 'COMPLETENESS'
  | 'ACCURACY'
  | 'VALUATION'
  | 'RIGHTS_AND_OBLIGATIONS'
  | 'PRESENTATION_DISCLOSURE';

export type ControlFrequency =
  | 'continuous_realtime'
  | 'daily'
  | 'weekly'
  | 'monthly_close'
  | 'quarterly';

export type AutomationLevel =
  | 'fully_automated'
  | 'semi_automated'
  | 'manual_detective';

export type ControlEvaluationStatus =
  | 'not_tested'
  | 'effective'
  | 'deficiency'
  | 'significant_deficiency'
  | 'material_weakness';

export type ConsolidationEntityCode =
  | 'SOPHIA_GLOBAL_INC'
  | 'SOPHIA_SG_PTE_LTD'
  | 'SOPHIA_VN_CO_LTD'
  | 'CONSOLIDATED_GROUP';

export type FunctionalCurrency = 'USD' | 'SGD' | 'VND';

export type CtaBalanceType = 'CREDIT' | 'DEBIT' | 'ZERO';

export type ConsolidationStatus =
  | 'draft'
  | 'eliminated'
  | 'reconciled'
  | 'locked'
  | 'audited';
