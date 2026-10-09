/**
 * Approval Service class facade for deploy guard approval management
 *
 * @module forest/deploy-guard/approval/approval-service
 */

import { DeployApproval, DeployOverride, DeployApprovalStatus, ApprovalDetailDto } from '../types';
import { auditDeployGuardEvent, getDeployGuardHistory, DeployGuardAuditParams } from './audit-logger';
import { createApprovalRecord, getApprovalRecord, listPendingApprovals, CreateApprovalParams } from './approval-crud';
import { recordAttestation, approveApprovalRecord, rejectApprovalRecord } from './attestation-recorder';
import { requestOverrideRecord, isDeploymentAllowedCheck, RequestOverrideParams } from './gate-checker';

/**
 * ApprovalService singleton (stateless, DB-backed)
 */
export class ApprovalService {
  async createApproval(payload: CreateApprovalParams): Promise<{ approvalId: string; status: DeployApprovalStatus }> {
    return createApprovalRecord(payload);
  }

  async getApproval(approvalId: string): Promise<ApprovalDetailDto | null> {
    return getApprovalRecord(approvalId);
  }

  async attest(
    approvalId: string,
    operatorId: string,
    signature: string,
    operatorHost: string,
  ): Promise<{ success: boolean; remaining: number; quorumReached: boolean }> {
    return recordAttestation(approvalId, operatorId, signature, operatorHost);
  }

  async approveApproval(approvalId: string): Promise<void> {
    return approveApprovalRecord(approvalId);
  }

  async rejectApproval(approvalId: string, operatorId: string, reason: string): Promise<void> {
    return rejectApprovalRecord(approvalId, operatorId, reason);
  }

  async requestOverride(payload: RequestOverrideParams): Promise<DeployOverride> {
    return requestOverrideRecord(payload);
  }

  async listPending(limit: number = 50, offset: number = 0): Promise<DeployApproval[]> {
    return listPendingApprovals(limit, offset);
  }

  async getHistory(
    limit: number = 100,
    cursor?: string,
  ): Promise<{ entries: Record<string, unknown>[]; nextCursor: string | null }> {
    return getDeployGuardHistory(limit, cursor);
  }

  async isDeploymentAllowed(commitSha: string): Promise<{ allowed: boolean; reason?: string }> {
    return isDeploymentAllowedCheck(commitSha);
  }

  /**
   * Internal: audit event logging (exposed for backwards compatibility / tests)
   */
  async auditEvent(params: DeployGuardAuditParams): Promise<void> {
    return auditDeployGuardEvent(params);
  }
}

export const approvalService = new ApprovalService();
