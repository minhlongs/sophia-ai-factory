/**
 * API client helpers for the public-publish approval ledger queue.
 * Drives GET /api/publish-approvals and PATCH /api/publish-approvals/[id].
 * @module components/approval-queue/publish-queue-api
 */

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/seed/security/csrf';

export type TikTokPrivacyChoice =
  | 'PUBLIC_TO_EVERYONE'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'SELF_ONLY';

export interface PublishComplianceMetadata {
  privacyLevel?: TikTokPrivacyChoice;
  brandOrganicToggle?: boolean;
  brandContentToggle?: boolean;
  containsSyntheticMedia?: boolean;
}

export interface PublishApprovalItem {
  id: string;
  tenantId: string;
  channelId: string;
  platform: string;
  mediaRef: string;
  createdAt: number;
  expiresAt: number;
  unauditedSelfOnly?: boolean;
}

export interface PublishApprovalResolutionResult {
  resolved: boolean;
  alreadyResolved: boolean;
  decision: string;
  selfApproval?: boolean;
  id: string;
  compliance?: PublishComplianceMetadata;
}

export async function fetchPublishApprovals(limit = 50): Promise<PublishApprovalItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`/api/publish-approvals?${params.toString()}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error((body.error as string) || `HTTP ${res.status}`);
  }
  const json = (await res.json()) as { approvals?: PublishApprovalItem[] };
  return Array.isArray(json.approvals) ? json.approvals : [];
}

function buildCsrfHeaders(): Record<string, string> {
  if (typeof document === 'undefined' || !document.cookie) return {};
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  const token = match?.slice(CSRF_COOKIE_NAME.length + 1);
  return token ? { [CSRF_HEADER_NAME]: token } : {};
}

export async function submitPublishApprovalDecision(
  approvalId: string,
  approved: boolean,
  comment?: string,
  compliance?: PublishComplianceMetadata,
): Promise<PublishApprovalResolutionResult> {
  const res = await fetch(`/api/publish-approvals/${encodeURIComponent(approvalId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...buildCsrfHeaders() },
    credentials: 'include',
    body: JSON.stringify({
      approved,
      ...(comment && comment.trim().length > 0 ? { comment: comment.trim() } : {}),
      ...(compliance && Object.keys(compliance).length > 0 ? { compliance } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.message as string) || (body.error as string) || `HTTP ${res.status}`);
  }
  return body as unknown as PublishApprovalResolutionResult;
}
