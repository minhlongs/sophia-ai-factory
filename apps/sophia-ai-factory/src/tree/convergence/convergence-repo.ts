/**
 * Authoritative Convergence Ledger Repository (Gate S1, Gate S3)
 * Layer: tree/convergence
 */

import { success, failure, type Result } from '@/seed/types/result';
import { canAdvanceStage } from './convergence-projector';
import type { CasTransitionInput, ConvergenceLedgerRecord, CreateConvergenceJobInput } from './convergence-types';

export interface ConvergenceError {
  code: 'IDEMPOTENCY_CONFLICT' | 'NOT_FOUND' | 'CAS_VERSION_CONFLICT' | 'LEASE_HELD' | 'INVALID_STAGE_TRANSITION' | 'TENANT_MISMATCH';
  message: string;
}

export class ConvergenceLedgerRepo {
  private readonly byId = new Map<string, ConvergenceLedgerRecord>();
  private readonly byIdempotency = new Map<string, string>();

  createOrGetIdempotent(
    input: CreateConvergenceJobInput
  ): Result<{ record: ConvergenceLedgerRecord; deduplicated: boolean }, ConvergenceError> {
    const idemKey = `${input.workspaceId}::${input.idempotencyKey}`;
    const existingId = this.byIdempotency.get(idemKey);
    if (existingId) {
      const existing = this.byId.get(existingId);
      if (existing) return success({ record: { ...existing }, deduplicated: true });
    }
    if (this.byId.has(input.jobId)) {
      return failure({ code: 'IDEMPOTENCY_CONFLICT', message: `Job ${input.jobId} already exists` });
    }
    const now = input.nowMs ?? Date.now();
    const record: ConvergenceLedgerRecord = {
      jobId: input.jobId, workspaceId: input.workspaceId, userId: input.userId,
      missionId: input.missionId ?? null, executionRunId: input.executionRunId ?? null, mekongJobId: input.mekongJobId ?? null,
      idempotencyKey: input.idempotencyKey, attemptNo: 1, leaseToken: null, leaseExpiresAt: null, version: 1,
      lifecycleStage: 'creative_mission_intake', executionOutcome: 'pending', verificationOutcome: 'pending',
      deliveryOutcome: 'pending', businessOutcome: 'pending', executionMode: input.executionMode ?? 'LOCAL_DETERMINISTIC',
      sideEffectUncertain: false, crashPreservedPath: null,
      estimatedCostUsd: input.estimatedCostUsd ?? 0, actualCostUsd: 0, retryCostUsd: 0, artifactManifest: [],
      verificationReport: { hasVerifiedMedia: false, checkedCount: 0, passedCount: 0, checksumMatched: false, durationValid: false },
      createdAt: now, updatedAt: now,
    };
    this.byId.set(record.jobId, record);
    this.byIdempotency.set(idemKey, record.jobId);
    return success({ record: { ...record }, deduplicated: false });
  }

  getByIdForWorkspace(jobId: string, workspaceId: string): Result<ConvergenceLedgerRecord, ConvergenceError> {
    const record = this.byId.get(jobId);
    if (!record) return failure({ code: 'NOT_FOUND', message: `Job ${jobId} not found` });
    if (record.workspaceId !== workspaceId) return failure({ code: 'TENANT_MISMATCH', message: 'Cross-tenant access denied' });
    return success({ ...record });
  }

  acquireLease(
    jobId: string, workspaceId: string, leaseToken: string, ttlMs: number, nowMs = Date.now()
  ): Result<ConvergenceLedgerRecord, ConvergenceError> {
    const current = this.byId.get(jobId);
    if (!current) return failure({ code: 'NOT_FOUND', message: `Job ${jobId} not found` });
    if (current.workspaceId !== workspaceId) return failure({ code: 'TENANT_MISMATCH', message: 'Cross-tenant lease denied' });
    if (current.leaseToken && current.leaseToken !== leaseToken && (current.leaseExpiresAt ?? 0) > nowMs) {
      return failure({ code: 'LEASE_HELD', message: `Active lease held until ${current.leaseExpiresAt}` });
    }
    const updated: ConvergenceLedgerRecord = {
      ...current, leaseToken, leaseExpiresAt: nowMs + ttlMs, version: current.version + 1, updatedAt: nowMs,
    };
    this.byId.set(jobId, updated);
    return success({ ...updated });
  }

  transitionCas(input: CasTransitionInput): Result<ConvergenceLedgerRecord, ConvergenceError> {
    const current = this.byId.get(input.jobId);
    if (!current) return failure({ code: 'NOT_FOUND', message: `Job ${input.jobId} not found` });
    if (current.workspaceId !== input.workspaceId) return failure({ code: 'TENANT_MISMATCH', message: 'Cross-tenant transition denied' });
    if (current.version !== input.expectedVersion) {
      return failure({ code: 'CAS_VERSION_CONFLICT', message: `Expected version ${input.expectedVersion}, found ${current.version}` });
    }
    const now = input.nowMs ?? Date.now();
    const leaseExpired = (current.leaseExpiresAt ?? 0) <= now;
    if (current.leaseToken !== input.leaseToken || leaseExpired) {
      return failure({ code: 'LEASE_HELD', message: leaseExpired ? 'Lease expired; re-acquire first' : 'Lease token mismatch' });
    }
    if (input.lifecycleStage && !canAdvanceStage(current.lifecycleStage, input.lifecycleStage)) {
      return failure({ code: 'INVALID_STAGE_TRANSITION', message: `Cannot transition backwards from ${current.lifecycleStage} to ${input.lifecycleStage}` });
    }
    const updated: ConvergenceLedgerRecord = {
      ...current,
      version: current.version + 1, leaseToken: input.leaseToken,
      lifecycleStage: input.lifecycleStage ?? current.lifecycleStage,
      executionOutcome: input.axes?.executionOutcome ?? current.executionOutcome,
      verificationOutcome: input.axes?.verificationOutcome ?? current.verificationOutcome,
      deliveryOutcome: input.axes?.deliveryOutcome ?? current.deliveryOutcome,
      businessOutcome: input.axes?.businessOutcome ?? current.businessOutcome,
      executionMode: input.executionMode ?? current.executionMode,
      attemptNo: input.attemptNo ?? current.attemptNo,
      mekongJobId: input.mekongJobId !== undefined ? input.mekongJobId : current.mekongJobId,
      sideEffectUncertain: input.sideEffectUncertain ?? current.sideEffectUncertain,
      crashPreservedPath: input.crashPreservedPath !== undefined ? input.crashPreservedPath : current.crashPreservedPath,
      actualCostUsd: input.actualCostUsd ?? current.actualCostUsd,
      retryCostUsd: input.retryCostUsd ?? current.retryCostUsd,
      artifactManifest: input.artifactManifest ?? current.artifactManifest,
      verificationReport: input.verificationReport ?? current.verificationReport,
      updatedAt: now,
    };
    this.byId.set(input.jobId, updated);
    return success({ ...updated });
  }

  listByWorkspace(workspaceId: string): ConvergenceLedgerRecord[] {
    return Array.from(this.byId.values()).filter((r) => r.workspaceId === workspaceId).map((r) => ({ ...r }));
  }
}
