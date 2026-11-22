/**
 * Compliance Publish Gate — Strict Zod HTTP Schemas & Private JSON Response Helper.
 *
 * Rejects any attempt to override `publicationMode` away from `MOCK_ONLY`.
 *
 * Layer: land (API transport validation).
 * @module land/publish-gate/publish-gate-http-schemas
 */

import { z } from 'zod';
import {
  PUBLICATION_MODE_MOCK_ONLY,
  PUBLISH_GATE_PLATFORMS,
  type PublishGatePayload,
} from '@/tree/publish-gate/types';

export const failureInjectionSchema = z
  .enum([
    'none',
    'timeout_uncertain',
    'non_retriable_4xx',
    'rate_limit_429',
    'unaudited_self_only',
    'creator_info_unavailable',
    'non_professional_account',
    'container_error',
    'quota_exceeded',
  ])
  .optional();

const tiktokComplianceSchema = z
  .object({
    privacyLevel: z
      .enum([
        'PUBLIC_TO_EVERYONE',
        'MUTUAL_FOLLOW_FRIENDS',
        'FOLLOWER_OF_CREATOR',
        'SELF_ONLY',
      ])
      .nullable(),
    commercialContentToggle: z.boolean(),
    brandOrganicToggle: z.boolean(),
    brandContentToggle: z.boolean(),
    isAigc: z.boolean(),
    musicUsageConfirmed: z.boolean(),
    brandedContentPolicyConfirmed: z.boolean(),
    allowComment: z.boolean(),
    allowDuet: z.boolean(),
    allowStitch: z.boolean(),
    useDraftInboxFallback: z.boolean().optional(),
  })
  .strict();

const youtubeComplianceSchema = z
  .object({
    privacyStatus: z.enum(['public', 'private', 'unlisted']).nullable(),
    selfDeclaredMadeForKids: z.boolean().nullable(),
    containsSyntheticMedia: z.boolean().nullable(),
    categoryId: z.string().trim().max(16).optional(),
  })
  .strict();

const instagramComplianceSchema = z
  .object({
    accountType: z.enum(['BUSINESS', 'CREATOR', 'PERSONAL']),
    loginProvider: z.enum(['facebook_login', 'instagram_login']),
    isPaidPartnership: z.boolean(),
    brandedContentSponsorIds: z.array(z.string().trim().min(1).max(128)).max(5),
    isCloseFriendsOnly: z.boolean().optional(),
    containerReady: z.boolean(),
  })
  .strict();

export const publishGateComplianceSchema = z
  .object({
    aiSyntheticDisclosure: z.boolean(),
    commercialDisclosure: z.boolean(),
    tiktok: tiktokComplianceSchema.optional(),
    youtube: youtubeComplianceSchema.optional(),
    instagram: instagramComplianceSchema.optional(),
  })
  .strict();

export const publishGatePayloadInputSchema = z
  .object({
    campaignId: z.string().trim().min(1).max(128),
    mediaArtifactId: z.string().trim().min(1).max(128),
    mediaContentDigest: z
      .string()
      .trim()
      .regex(/^(sha256:)?[a-fA-F0-9]{16,128}$/, 'Invalid media content digest'),
    mediaDurationSec: z.number().int().min(1).max(43200),
    platform: z.enum(PUBLISH_GATE_PLATFORMS),
    destinationAccountId: z.string().trim().min(1).max(128),
    destinationAccountHandle: z.string().trim().min(1).max(128),
    caption: z.string().trim().min(1).max(2200),
    title: z.string().trim().max(100).optional(),
    payloadVersion: z.number().int().min(1).max(1000).default(1),
    publicationMode: z.literal(PUBLICATION_MODE_MOCK_ONLY).default(PUBLICATION_MODE_MOCK_ONLY),
    compliance: publishGateComplianceSchema,
  })
  .strict();

export const publishGatePostActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create'),
      payload: publishGatePayloadInputSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('preflight'),
      requestId: z.string().trim().min(1).max(128),
      failureInjection: failureInjectionSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('submit_for_approval'),
      requestId: z.string().trim().min(1).max(128),
    })
    .strict(),
  z
    .object({
      action: z.literal('approve'),
      requestId: z.string().trim().min(1).max(128),
      approvalNonce: z.string().trim().min(8).max(128),
      payloadDigestSha256: z.string().trim().min(16).max(128),
      approvalVersion: z.number().int().min(1).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal('reject'),
      requestId: z.string().trim().min(1).max(128),
      approvalNonce: z.string().trim().min(8).max(128),
      payloadDigestSha256: z.string().trim().min(16).max(128),
      approvalVersion: z.number().int().min(1).max(1000),
      rejectionReason: z.string().trim().min(1).max(500).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('execute_mock'),
      requestId: z.string().trim().min(1).max(128),
      payloadDigestSha256: z.string().trim().min(16).max(128),
      failureInjection: failureInjectionSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('mutate_payload'),
      requestId: z.string().trim().min(1).max(128),
      payload: publishGatePayloadInputSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('reconcile'),
      requestId: z.string().trim().min(1).max(128),
      resolution: z.enum(['SIMULATED_PUBLISHED', 'SIMULATED_FAILED']),
      reasonCode: z.string().trim().min(1).max(128),
    })
    .strict(),
]);

export type PublishGatePostAction = z.infer<typeof publishGatePostActionSchema>;

export function toCanonicalPayload(
  input: z.infer<typeof publishGatePayloadInputSchema>,
): PublishGatePayload {
  return {
    ...input,
    publicationMode: PUBLICATION_MODE_MOCK_ONLY,
  };
}

export function jsonPrivate(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
}
