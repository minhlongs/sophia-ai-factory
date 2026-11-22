/**
 * Compliance Publish Gate (Track B2) Inngest event payload types.
 *
 * Layer: seed (foundational — no domain imports).
 * @module seed/inngest/publish-gate-event-types
 */

export type PublishGateRequestedEventData = {
  data: {
    readonly requestId: string;
    readonly orgId: string;
    readonly campaignId: string;
    readonly platform: 'tiktok' | 'youtube' | 'instagram';
    readonly payloadDigestSha256: string;
    readonly approvalVersion: number;
    readonly publicationMode: 'MOCK_ONLY';
  };
};

export type PublishGateHumanApprovedEventData = {
  data: {
    readonly requestId: string;
    readonly orgId: string;
    readonly approverUserId: string;
    readonly approvalNonce: string;
    readonly payloadDigestSha256: string;
    readonly approvalVersion: number;
    readonly decision: 'approved' | 'rejected';
    readonly publicationMode: 'MOCK_ONLY';
  };
};
