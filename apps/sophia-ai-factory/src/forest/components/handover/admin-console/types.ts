/**
 * Admin Console Submodule: Types and Interfaces.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/admin-console/types
 */

import type {
  CustomerHandoverRecord,
  VerificationRunReport,
} from '@/seed/handover/handover-types';
import type { Result } from '@/seed/types/result';

export interface HandoverAdminConsoleStats {
  total: number;
  pending: number;
  active: number;
  accepted: number;
  rejected: number;
}

export interface DrDrillReport {
  status: 'PASS' | 'FAIL' | 'WARN';
  latencyMs: number;
  tablesVerified: number;
  details: string;
}

export type StatusFilterType = 'all' | 'pending' | 'accepted' | 'at_risk';

export interface HandoverAdminConsoleClientProps {
  handovers: CustomerHandoverRecord[];
  initialStats: HandoverAdminConsoleStats;
  onVerifyAction?: (
    handoverId?: string,
  ) => Promise<Result<VerificationRunReport, { code: string; message: string }>>;
  onExportEnvAction?: () => Promise<
    Result<
      { sanitizedContent: string; missingKeys: string[]; totalKeys: number },
      { code: string; message: string }
    >
  >;
}
