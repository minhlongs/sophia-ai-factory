/**
 * Audit Logging Service
 *
 * Writes and queries audit log records for all RaaS license operations.
 * Audit logs capture CREATE, VALIDATE, REVOKE, UPDATE events.
 *
 * @module raas/audit-logging-service
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import type { Tier } from '@/types';
import type {
  RaasAuditLogInsert,
  Json,
} from '@/lib/supabase/types';
import type { AuditAction } from '@/lib/raas-schema';

// -------------------------------------------------------------------------
// Internal types
// -------------------------------------------------------------------------

interface AuditLogParams {
  action: AuditAction;
  nonce: string;
  tier?: string;
  timestamp: number;
  createdBy?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/**
 * Get license ID from nonce (best-effort, for foreign key in audit log)
 */
async function getLicenseIdFromNonce(nonce: string): Promise<string | null> {
  try {
    const db = createServerClient();
    const { data } = await db.from('raas_licenses').select('id').eq('nonce', nonce).single();
    return (data as { id?: string } | null)?.id || null;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------------------
// Audit writes
// -------------------------------------------------------------------------

/**
 * Log an audit action to raas_audit_logs
 */
export async function logAuditAction(params: AuditLogParams): Promise<void> {
  const db = createServerClient();
  const createdAt = Math.floor(Date.now() / 1000);

  const licenseId = await getLicenseIdFromNonce(params.nonce);

  const logData: RaasAuditLogInsert = {
    action: params.action,
    license_id: licenseId,
    license_nonce: params.nonce,
    user_id: params.userId ?? params.createdBy ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: (params.details ?? {
      tier: params.tier,
      timestamp: params.timestamp,
      createdBy: params.createdBy,
    }) as Json,
  };

  const { error } = await db.from('raas_audit_logs').insert(logData as unknown as Record<string, unknown>);

  if (error) {
    logger.error('Failed to log audit action', toError(error));
    // Don't throw — audit logging failure shouldn't block main operation
  }
}

/**
 * Log license creation event
 */
export async function logLicenseCreation(params: {
  nonce: string;
  tier: Tier;
  timestamp: number;
  createdBy?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await logAuditAction({
    action: 'CREATE',
    nonce: params.nonce,
    tier: params.tier,
    timestamp: params.timestamp,
    createdBy: params.createdBy,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log license validation attempt
 */
export async function logLicenseValidation(params: {
  nonce: string;
  isValid: boolean;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await logAuditAction({
    action: 'VALIDATE',
    nonce: params.nonce,
    timestamp: Math.floor(Date.now() / 1000),
    userId: params.userId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    details: { isValid: params.isValid },
  });
}

/**
 * Log license revocation event
 */
export async function logLicenseRevocation(params: {
  nonce: string;
  tier?: string;
  revokedBy?: string;
  reason?: string;
  ipAddress?: string;
}): Promise<void> {
  await logAuditAction({
    action: 'REVOKE',
    nonce: params.nonce,
    tier: params.tier,
    timestamp: Math.floor(Date.now() / 1000),
    userId: params.revokedBy,
    ipAddress: params.ipAddress,
    details: { revokedBy: params.revokedBy, reason: params.reason },
  });
}

/**
 * Log license extension event
 */
export async function logLicenseExtension(params: {
  nonce: string;
  tier?: string;
  days: number;
  extendedBy?: string;
  previousExpiresAt?: number;
  newExpiresAt?: number;
}): Promise<void> {
  await logAuditAction({
    action: 'UPDATE',
    nonce: params.nonce,
    tier: params.tier,
    timestamp: Math.floor(Date.now() / 1000),
    userId: params.extendedBy,
    details: {
      action: 'EXTEND',
      extendedBy: params.extendedBy,
      days: params.days,
      previousExpiresAt: params.previousExpiresAt,
      newExpiresAt: params.newExpiresAt,
    },
  });
}

// Audit query functions moved to ./audit-query-service.ts
