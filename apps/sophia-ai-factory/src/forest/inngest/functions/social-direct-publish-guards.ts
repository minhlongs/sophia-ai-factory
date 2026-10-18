/**
 * Safety guards and status evaluation for social direct publishing.
 * Layer: forest/inngest/functions
 * @module forest/inngest/functions/social-direct-publish-guards
 */

import { evaluateChannelPacing } from '@/tree/social/publisher/pacing-engine';
import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import type {
  SocialPublishDispatchedEventData,
  ChannelCredentialSnapshot,
} from './social-direct-publish-steps';

export function evaluatePacingStepDecision(
  data: SocialPublishDispatchedEventData,
  cred: ChannelCredentialSnapshot | null,
): { allowed: boolean; reason: string; delayMs: number } {
  const decision = evaluateChannelPacing({
    platform: data.platform,
    channelId: data.channelId,
    todayPublishedCount: cred?.dailyPostCount ?? 0,
    lastPublishedAtMs: cred?.lastPublishedAt ?? null,
  });
  if (decision.reason === 'DAILY_CAP_EXCEEDED') {
    return { allowed: false, reason: decision.reason, delayMs: 0 };
  }
  return { allowed: decision.allowed, reason: decision.reason, delayMs: decision.delayMs };
}

export function evaluateSafetyGuardsDecision(
  data: SocialPublishDispatchedEventData,
  cred: ChannelCredentialSnapshot | null,
): { allowed: boolean; reason: string; errorMessage?: string } {
  if (!cred) {
    return { allowed: false, reason: 'CREDENTIAL_NOT_FOUND', errorMessage: 'Channel credential not found' };
  }
  if (cred.killSwitchActive) {
    return { allowed: false, reason: 'KILL_SWITCH_ACTIVE', errorMessage: 'Channel emergency kill switch active' };
  }
  if (!shouldAllowRequest(data.platform, data.channelId)) {
    return { allowed: false, reason: 'CIRCUIT_BREAKER_OPEN', errorMessage: 'Platform circuit breaker open' };
  }
  return { allowed: true, reason: 'OK' };
}
