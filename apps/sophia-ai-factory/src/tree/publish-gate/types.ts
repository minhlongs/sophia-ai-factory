/**
 * Compliance Publish Gate — Canonical Domain Types (MOCK_ONLY).
 *
 * Layer: tree (domain logic).
 * @module tree/publish-gate/types
 */

export const PUBLISH_GATE_PLATFORMS = ['tiktok', 'youtube', 'instagram'] as const;
export type PublishGatePlatform = (typeof PUBLISH_GATE_PLATFORMS)[number];

export const PUBLICATION_MODE_MOCK_ONLY = 'MOCK_ONLY' as const;
export type PublicationMode = typeof PUBLICATION_MODE_MOCK_ONLY;

export const PUBLISH_GATE_STATES = [
  'DRAFT',
  'PREFLIGHT_REQUIRED',
  'PREFLIGHT_BLOCKED',
  'READY_FOR_REVIEW',
  'AWAITING_HUMAN_APPROVAL',
  'APPROVED',
  'REJECTED',
  'APPROVAL_EXPIRED',
  'MOCK_EXECUTION_CLAIMED',
  'SIMULATED_PUBLISHED',
  'SIMULATED_FAILED',
  'RECONCILIATION_REQUIRED',
] as const;

export type PublishGateState = (typeof PUBLISH_GATE_STATES)[number];

export type MockFailureInjectionMode =
  | 'none'
  | 'timeout_uncertain'
  | 'non_retriable_4xx'
  | 'rate_limit_429'
  | 'unaudited_self_only'
  | 'creator_info_unavailable'
  | 'non_professional_account'
  | 'container_error'
  | 'quota_exceeded';

export type TikTokPrivacyLevel =
  | 'PUBLIC_TO_EVERYONE'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'FOLLOWER_OF_CREATOR'
  | 'SELF_ONLY';

export type YouTubePrivacyStatus = 'public' | 'private' | 'unlisted';

export interface TikTokComplianceInput {
  readonly privacyLevel: TikTokPrivacyLevel | null;
  readonly commercialContentToggle: boolean;
  readonly brandOrganicToggle: boolean;
  readonly brandContentToggle: boolean;
  readonly isAigc: boolean;
  readonly musicUsageConfirmed: boolean;
  readonly brandedContentPolicyConfirmed: boolean;
  readonly allowComment: boolean;
  readonly allowDuet: boolean;
  readonly allowStitch: boolean;
  readonly useDraftInboxFallback?: boolean;
}

export interface YouTubeComplianceInput {
  readonly privacyStatus: YouTubePrivacyStatus | null;
  readonly selfDeclaredMadeForKids: boolean | null;
  readonly containsSyntheticMedia: boolean | null;
  readonly categoryId?: string;
}

export interface InstagramComplianceInput {
  readonly accountType: 'BUSINESS' | 'CREATOR' | 'PERSONAL';
  readonly loginProvider: 'facebook_login' | 'instagram_login';
  readonly isPaidPartnership: boolean;
  readonly brandedContentSponsorIds: readonly string[];
  readonly isCloseFriendsOnly?: boolean;
  readonly containerReady: boolean;
}

export interface PublishGateCompliance {
  readonly aiSyntheticDisclosure: boolean;
  readonly commercialDisclosure: boolean;
  readonly tiktok?: TikTokComplianceInput;
  readonly youtube?: YouTubeComplianceInput;
  readonly instagram?: InstagramComplianceInput;
}

export interface PublishGatePayload {
  readonly campaignId: string;
  readonly mediaArtifactId: string;
  readonly mediaContentDigest: string;
  readonly mediaDurationSec: number;
  readonly platform: PublishGatePlatform;
  readonly destinationAccountId: string;
  readonly destinationAccountHandle: string;
  readonly caption: string;
  readonly title?: string;
  readonly payloadVersion: number;
  readonly publicationMode: PublicationMode;
  readonly compliance: PublishGateCompliance;
}

export type CapabilityStatus = 'SUPPORTED' | 'RESTRICTED' | 'UNSUPPORTED' | 'UNKNOWN';

export interface PlatformCapabilitySnapshot {
  readonly platform: PublishGatePlatform;
  readonly capabilityStatus: CapabilityStatus;
  readonly verifiedDate: string;
  readonly isAuditedApp: boolean;
  readonly allowedPrivacyOptions: readonly string[];
  readonly maxVideoDurationSec: number;
  readonly commentDisabled: boolean;
  readonly duetDisabled: boolean;
  readonly stitchDisabled: boolean;
  readonly dailyPublishLimit: number;
  readonly dailyPublishUsed: number;
  readonly requiredScopes: readonly string[];
  readonly warnings: readonly string[];
  readonly blockReasons: readonly string[];
}

export interface MockExecutionReceipt {
  readonly publicationMode: PublicationMode;
  readonly simulated: true;
  readonly platform: PublishGatePlatform;
  readonly mockReceiptId: string;
  readonly simulatedStatus: 'SIMULATED_PUBLISHED' | 'SIMULATED_FAILED' | 'RECONCILIATION_REQUIRED';
  readonly publicUrl: null;
  readonly draftInboxRouted: boolean;
  readonly retriable: boolean;
  readonly errorCode: string | null;
  readonly message: string;
  readonly executedAtIso: string;
  readonly payloadDigestSha256: string;
  readonly executionClaimId: string;
}

export interface PublishGateRecord {
  readonly requestId: string;
  readonly orgId: string;
  readonly userId: string;
  readonly campaignId: string;
  readonly mediaArtifactId: string;
  readonly mediaContentDigest: string;
  readonly platform: PublishGatePlatform;
  readonly destinationAccountId: string;
  readonly idempotencyKey: string;
  readonly publicationMode: PublicationMode;
  readonly state: PublishGateState;
  readonly version: number;
  readonly approvalVersion: number;
  readonly payload: PublishGatePayload;
  readonly payloadDigestSha256: string;
  readonly capabilitySnapshot: PlatformCapabilitySnapshot | null;
  readonly compliance: PublishGateCompliance;
  readonly approvalNonce: string | null;
  readonly approvalNonceUsedAtIso: string | null;
  readonly approvalExpiresAtIso: string | null;
  readonly approvedByUserId: string | null;
  readonly approvedAtIso: string | null;
  readonly rejectionReason: string | null;
  readonly executionClaimId: string | null;
  readonly mockReceipt: MockExecutionReceipt | null;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}

export interface PublishGateAuditEvent {
  readonly eventId: string;
  readonly requestId: string;
  readonly orgId: string;
  readonly actorUserId: string;
  readonly fromState: PublishGateState | null;
  readonly toState: PublishGateState;
  readonly eventType: string;
  readonly reasonCode: string | null;
  readonly payloadDigestSha256: string;
  readonly metadataJson: string | null;
  readonly createdAtIso: string;
}
