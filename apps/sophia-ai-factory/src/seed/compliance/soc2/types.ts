import type { Tier } from '@/seed/types';

export type ControlId = string;
export type ControlCategory =
  | 'security'
  | 'availability'
  | 'processing_integrity'
  | 'confidentiality'
  | 'privacy';

export interface SOC2Control {
  id: ControlId;
  category: ControlCategory;
  title: string;
  description: string;
  /** Probe returns true if control is SATISFIED. */
  probe: (tier: Tier) => boolean;
  /** Human-readable evidence string shown when probe returns false. */
  evidenceMissing?: string;
  /** Evidence that cannot be proven from runtime config alone. */
  externalEvidenceRequired?: string;
}

export type SOC2Finding = {
  controlId: ControlId;
  title: string;
  category: ControlCategory;
  status: 'pass' | 'fail' | 'not_applicable';
  note?: string;
  evidenceMissing?: string;
};

export interface SOC2ReadinessResult {
  tier: Tier;
  timestamp: string;
  totalControls: number;
  passed: number;
  failed: number;
  notApplicable: number;
  score: number;
  findings: SOC2Finding[];
  recommendation?: string;
}
