/**
 * Schemas and types for Admin Violations API
 * @module api/admin/violations/violations-schemas
 */

import { z } from 'zod'

export const violationsListSchema = z.object({
  type: z.enum(['quota_exceeded', 'invalid_license', 'expired_license', 'revoked_license', 'rate_limit_exceeded', 'unauthorized_access', 'cross_tenant_access']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  license_id: z.string().max(100).optional(),
  resolved: z.enum(['true', 'false']).optional(),
  date_from: z.string().max(20).optional(),
  date_to: z.string().max(20).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const violationActionSchema = z.object({
  violationId: z.string().uuid(),
  action: z.enum(['resolve', 'escalate']),
  reason: z.string().min(1).max(500),
})

export interface ViolationRecord {
  id: string; type: string; severity: string; userId: string; licenseNonce: string; tier: string; endpoint: string; ipAddress: string | null; userAgent: string | null; metadata: Record<string, unknown> | null; createdAt: string; resolved: boolean; resolvedAt: string | null; resolvedBy: string | null; userEmail?: string; licenseTier?: string; licenseStatus?: string
}

export interface ViolationRow {
  id: string; type: string; severity: string; user_id: string; license_nonce: string; tier: string; endpoint: string; ip_address: string | null; user_agent: string | null; metadata: Record<string, unknown> | null; created_at: string; resolved: boolean; resolved_at: string | null; resolved_by: string | null
}

export interface LicenseInfo { license_nonce: string; tier: string; status: string }
export interface UserInfo { user_id: string; email: string }
