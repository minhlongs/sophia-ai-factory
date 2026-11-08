/**
 * Publish Approval Types
 * Layer: TREE (domain-specific reusable)
 *
 * A publish that reaches a public channel is the one action in this system
 * that cannot be undone by the person who triggered it, so it is the one action
 * that needs a human decision between "the render finished" and "the world can
 * see it". These types describe that decision and the ledger that makes it
 * survive replay.
 *
 * @module tree/publishing/approval/types
 */

/** The scope a publish approval covers — one job on one channel. */
export interface PublishApprovalSubject {
  /** Workspace or user the publish belongs to. */
  readonly tenantId: string;
  /** Platform channel the media is going to. */
  readonly channelId: string;
  /** Provider/platform identifier, e.g. `youtube`, `tiktok`. */
  readonly platform: string;
  /** Stable identifier of the media, e.g. the R2 object key or source URL. */
  readonly mediaRef: string;
}

/** Human decision on a publish. */
export type PublishApprovalDecision = 'approved' | 'rejected' | 'pending' | 'expired';

/** What the ledger says about a publish attempt. */
export interface PublishLedgerRecord {
  readonly idempotencyKey: string;
  readonly tenantId: string;
  readonly channelId: string;
  readonly platform: string;
  readonly mediaRef: string;
  readonly decision: PublishApprovalDecision;
  readonly requesterId?: string;
  readonly reviewerId?: string;
  readonly comment?: string;
  readonly approvedAt?: number;
  readonly expiresAt?: number;
  readonly createdAt: number;
}

/** Result of asking whether a publish may proceed. */
export type PublishApprovalState =
  | { readonly outcome: 'allowed' }
  | { readonly outcome: 'needs_approval'; readonly reason: string; readonly reasonVi: string }
  | { readonly outcome: 'blocked'; readonly reason: string; readonly reasonVi: string };

/** The slice of step tools a publish approval gate needs (injectable for tests). */
export interface PublishApprovalStep {
  run<T>(id: string, fn: () => Promise<T>): Promise<T>;
  waitForEvent(
    id: string,
    opts: { event: string; timeout: number | string },
  ): Promise<{ data: Record<string, unknown> } | null>;
  sendEvent(
    id: string,
    payload: { name: string; data: Record<string, unknown> },
  ): Promise<unknown>;
}
