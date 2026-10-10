/**
 * GPU Mesh SLA & Incident Types
 *
 * Layer: seed/types/gpu-mesh
 */

import type {
  GpuMeshRegion,
  BreachType,
  CompensationRail,
  RefundStatus,
} from './types';

export interface SlaDegradationIncidentRow {
  id: string;
  reservation_id: string;
  org_id: string;
  breach_type: BreachType;
  region: GpuMeshRegion;
  target_threshold: number;
  measured_value: number;
  started_at: number;
  resolved_at: number | null;
  duration_seconds: number | null;
  impacted_jobs_count: number;
  credit_amount_cents: number;
  compensation_rail: CompensationRail;
  refund_status: RefundStatus;
  refund_ledger_id: string | null;
  detected_by: string;
  resolution_notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface SlaDegradationIncident {
  id: string;
  reservationId: string;
  orgId: string;
  breachType: BreachType;
  region: GpuMeshRegion;
  targetThreshold: number;
  measuredValue: number;
  startedAt: number;
  resolvedAt?: number | null;
  durationSeconds?: number | null;
  impactedJobsCount: number;
  creditAmountCents: number;
  compensationRail: CompensationRail;
  refundStatus: RefundStatus;
  refundLedgerId?: string | null;
  detectedBy: string;
  resolutionNotes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SliMeasurement {
  reservationId: string;
  orgId: string;
  region: GpuMeshRegion;
  windowStart: number;
  windowEnd: number;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  availabilityRatio: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
  cascadingFailoverJobs: number;
  breaches: Array<{
    breachType: BreachType;
    targetThreshold: number;
    measuredValue: number;
  }>;
}

export interface SlaScanSummary {
  scannedReservations: number;
  incidentsDetected: number;
  incidentsDisbursed: number;
  totalCompensationMcu: number;
  totalCompensationCents: number;
  errors: string[];
}
