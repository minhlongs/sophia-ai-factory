/**
 * Durable Cloudflare D1 repository for Customer Pilot support and data-deletion requests.
 *
 * Strictly enforces `(org_id, user_id)` tenant isolation and avoids storing
 * duplicate personal data (email/raw prompts/keys) in the queue table.
 *
 * @module tree/first-value/pilot-support-repo
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PilotSupportRequestStatus,
  PilotSupportRequestSummary,
  PilotSupportRequestType,
} from '@/seed/pilot/pilot-access-policy';

export interface PilotSupportRequestRecord extends PilotSupportRequestSummary {
  readonly orgId: string;
  readonly userId: string;
  readonly message: string;
}

interface SupportRequestRow {
  id: string;
  org_id: string;
  user_id: string;
  request_type: PilotSupportRequestType;
  subject: string;
  message: string;
  status: PilotSupportRequestStatus;
  created_at_iso: string;
  updated_at_iso: string;
  resolved_at_iso: string | null;
}

function toSummary(row: SupportRequestRow): PilotSupportRequestSummary {
  return {
    id: row.id,
    requestType: row.request_type,
    subject: row.subject,
    status: row.status,
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
    resolvedAtIso: row.resolved_at_iso ?? null,
  };
}

export async function createPilotSupportRequest(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly requestType: PilotSupportRequestType;
    readonly subject: string;
    readonly message: string;
    readonly nowIso: string;
  },
): Promise<PilotSupportRequestRecord> {
  const id = `psr_${crypto.randomUUID()}`;
  const trimmedSubject = input.subject.trim();
  const trimmedMessage = input.message.trim();

  await d1
    .prepare(
      `INSERT INTO pilot_support_requests (
         id, org_id, user_id, request_type, subject, message, status,
         operator_note, created_at_iso, updated_at_iso, resolved_at_iso
       )
       VALUES (?, ?, ?, ?, ?, ?, 'open', NULL, ?, ?, NULL)`,
    )
    .bind(
      id,
      input.orgId,
      input.userId,
      input.requestType,
      trimmedSubject,
      trimmedMessage,
      input.nowIso,
      input.nowIso,
    )
    .run();

  return {
    id,
    orgId: input.orgId,
    userId: input.userId,
    requestType: input.requestType,
    subject: trimmedSubject,
    message: trimmedMessage,
    status: 'open',
    createdAtIso: input.nowIso,
    updatedAtIso: input.nowIso,
    resolvedAtIso: null,
  };
}

export async function listPilotSupportRequestsForUser(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly limit?: number;
  },
): Promise<readonly PilotSupportRequestSummary[]> {
  const safeLimit = Math.min(20, Math.max(1, input.limit ?? 5));
  const res = await d1
    .prepare(
      `SELECT id, org_id, user_id, request_type, subject, message, status,
              created_at_iso, updated_at_iso, resolved_at_iso
       FROM pilot_support_requests
       WHERE org_id = ? AND user_id = ?
       ORDER BY created_at_iso DESC
       LIMIT ?`,
    )
    .bind(input.orgId, input.userId, safeLimit)
    .all<SupportRequestRow>();

  return (res.results ?? []).map(toSummary);
}

export async function countOpenPilotSupportRequestsForUser(
  d1: D1Database,
  input: { readonly orgId: string; readonly userId: string },
): Promise<number> {
  const row = await d1
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM pilot_support_requests
       WHERE org_id = ? AND user_id = ? AND status IN ('open', 'acknowledged')`,
    )
    .bind(input.orgId, input.userId)
    .first<{ cnt: number }>();
  return Number(row?.cnt ?? 0);
}
