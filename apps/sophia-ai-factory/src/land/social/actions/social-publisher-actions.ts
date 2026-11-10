/**
 * Server Actions for Social Direct Publishing
 * Provides user-authenticated endpoints for publishing dispatch,
 * channel credentials, and emergency kill-switch toggles.
 * Layer: land (Server Actions) | Max LOC: < 130 | Strict TypeScript
 * @module land/social/actions/social-publisher-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import type { SocialPlatform, SocialPublishResult } from '@/seed/types/social-publisher-types';
import {
  listUserCredentials,
  setChannelKillSwitch,
} from '@/land/social/platform-credentials-store';
import type {
  DispatchSocialPublishInput,
  UpdateChannelCredentialsInput,
  SocialPublisherActionResponse,
} from './social-publisher-schemas';
import {
  executeDispatchSocialPublish,
  executeUpdateChannelCredentials,
} from './social-publisher-helpers';

export type {
  DispatchSocialPublishInput,
  UpdateChannelCredentialsInput,
  SocialPublisherActionResponse,
};

export async function dispatchSocialPublishAction(
  rawInput: DispatchSocialPublishInput,
): Promise<SocialPublisherActionResponse<SocialPublishResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized: login required', code: 'UNAUTHORIZED' };
    const gate = await enforceCommercialFeatureForUser(user.id, 'managed_social_oauth_relay');
    if (!gate.ok) {
      return { success: false, error: gate.error.message, code: gate.error.code };
    }
    return await executeDispatchSocialPublish(user.id, rawInput);
  } catch {
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}

export async function listConnectedChannelsAction(): Promise<SocialPublisherActionResponse<Array<{
  id: string; platform: SocialPlatform; channelId: string; channelName: string;
  dailyPostCount: number; tokenExpiresAt: number; lastPublishedAt?: number;
  killSwitchActive: boolean; updatedAt: number;
}>>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    const gate = await enforceCommercialFeatureForUser(user.id, 'managed_social_oauth_relay');
    if (!gate.ok) {
      return { success: false, error: gate.error.message, code: gate.error.code };
    }

    const creds = await listUserCredentials(user.id);
    const sanitized = creds.map((c) => ({
      id: c.id, platform: c.platform, channelId: c.channelId, channelName: c.channelName,
      dailyPostCount: c.dailyPostCount, tokenExpiresAt: c.tokenExpiresAt,
      lastPublishedAt: c.lastPublishedAt, killSwitchActive: c.killSwitchActive, updatedAt: c.updatedAt,
    }));
    return { success: true, data: sanitized };
  } catch {
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}

export async function toggleChannelKillSwitchAction(
  channelId: string,
  isKilled: boolean,
): Promise<SocialPublisherActionResponse<{ channelId: string; killSwitchActive: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    const gate = await enforceCommercialFeatureForUser(user.id, 'managed_social_oauth_relay');
    if (!gate.ok) {
      return { success: false, error: gate.error.message, code: gate.error.code };
    }
    if (!channelId) return { success: false, error: 'Channel ID required', code: 'VALIDATION_ERROR' };

    const updated = await setChannelKillSwitch(user.id, channelId, isKilled);
    if (!updated) return { success: false, error: 'Channel not found', code: 'NOT_FOUND' };

    return { success: true, data: { channelId, killSwitchActive: isKilled } };
  } catch {
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}

export async function triggerEmergencyKillSwitchAction(channelId: string) {
  return toggleChannelKillSwitchAction(channelId, true);
}

export async function updateChannelCredentialsAction(
  rawInput: UpdateChannelCredentialsInput,
): Promise<SocialPublisherActionResponse<{ channelId: string; platform: SocialPlatform }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    const gate = await enforceCommercialFeatureForUser(user.id, 'managed_social_oauth_relay');
    if (!gate.ok) {
      return { success: false, error: gate.error.message, code: gate.error.code };
    }
    return await executeUpdateChannelCredentials(user.id, rawInput);
  } catch {
    return { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' };
  }
}
