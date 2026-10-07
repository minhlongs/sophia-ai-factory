/**
 * Social Publish Dispatcher.
 * Safely dispatches scheduled short-form video payloads across multi-account pools with proxy isolation.
 */

import type {
  DispatchResult,
  PublishPayload,
  SocialAccountProfile,
} from './account-pool-types';
import {
  selectNextAccount,
  updateAccountStateAfterPublish,
} from './social-account-rotator';

export interface DispatcherContext {
  accounts: SocialAccountProfile[];
  nowIso?: string;
}

export function dispatchVideoToPool(
  payload: PublishPayload,
  context: DispatcherContext
): {
  result: DispatchResult;
  updatedAccounts: SocialAccountProfile[];
} {
  const { accounts, nowIso = new Date().toISOString() } = context;

  const targetAccount = selectNextAccount(
    accounts,
    payload.targetPlatform,
    payload.niche
  );

  if (!targetAccount) {
    return {
      result: {
        success: false,
        selectedAccountId: '',
        platform: payload.targetPlatform,
        rateLimitRemaining: 0,
        error: `No eligible active accounts available for platform "${payload.targetPlatform}" and niche "${payload.niche}"`,
      },
      updatedAccounts: accounts,
    };
  }

  const updatedAccount = updateAccountStateAfterPublish(targetAccount, nowIso);
  const remainingSlots = Math.max(
    0,
    updatedAccount.dailyPostLimit - updatedAccount.postsPublishedToday
  );

  const updatedAccounts = accounts.map((acc) =>
    acc.id === targetAccount.id ? updatedAccount : acc
  );

  return {
    result: {
      success: true,
      selectedAccountId: targetAccount.id,
      platform: payload.targetPlatform,
      scheduledTime: nowIso,
      proxyUsed: targetAccount.proxyUrl,
      rateLimitRemaining: remainingSlots,
    },
    updatedAccounts,
  };
}
