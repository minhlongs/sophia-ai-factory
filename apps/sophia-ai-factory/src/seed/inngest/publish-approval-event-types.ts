/**
 * Publish approval event payload types — canonical seed definitions.
 *
 * These two payloads back the round trip that lets a public publish wait for a
 * human decision: `publish.approval.requested` asks for one, and
 * `publish.approval.resolved` carries the answer. Both are shaped exactly as
 * the approval gate emits and re-reads them, so the ledger is the durable
 * record and the event is only the wake-up.
 *
 * Layer: seed (foundational — no domain imports).
 *
 * @module seed/inngest/publish-approval-event-types
 */

/** Payload for `publish.approval.requested` — emitted when a publish needs a human. */
export type PublishApprovalRequestedData = {
  data: {
    /** Deterministic key of the media/channel subject this decision covers. */
    idempotencyKey: string;
    tenantId: string;
    channelId: string;
    platform: string;
    mediaRef: string;
    requestedPrivacy: string;
  };
};

/** Payload for `publish.approval.resolved` — the reviewer's answer. */
export type PublishApprovalResolvedData = {
  data: {
    /** Same key the request was filed under, so a wait wakes for its own answer. */
    idempotencyKey: string;
    tenantId: string;
    channelId: string;
    platform: string;
    decision: "approved" | "rejected";
    reviewerId: string;
    comment?: string;
  };
};
