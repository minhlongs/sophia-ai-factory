'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AbandonedCartCallRecord,
  ParasiteSeoArticle,
} from '@/seed/types/growth-triad-v2-types';
import {
  createAndDispatchVoiceCartRecovery,
  createAndDispatchParasiteArticle,
} from './triad-execution-helpers';

/**
 * 1. Trigger Voice Cart Closer for an abandoned cart session
 */
export async function triggerVoiceCartRecoveryAction(input: {
  cartSessionId: string;
  customerPhone: string;
  customerName?: string;
  cartValue: number;
  productNames: string[];
}): Promise<{ success: boolean; callRecord?: AbandonedCartCallRecord; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const gate = await enforceCommercialFeatureForUser(user.id, 'growth_triad_bandit_kelly');
    if (!gate.ok) {
      return { success: false, error: 'FEATURE_LOCKED' };
    }

    const callRecord = await createAndDispatchVoiceCartRecovery(user.id, input);
    return { success: true, callRecord };
  } catch (err) {
    logger.error('[triad-execution-actions] Voice cart recovery failed', err instanceof Error ? err : undefined);
    return { success: false, error: 'FAILED_TO_TRIGGER_VOICE_CLOSER' };
  }
}

/**
 * 3. Syndicate Parasite SEO Article to High-DA platform
 */
export async function syndicateParasiteArticleAction(input: {
  skuCode: string;
  productName: string;
  price: number;
  targetPlatform: 'MEDIUM' | 'SUBSTACK' | 'LINKEDIN_PULSE' | 'WORDPRESS_NETWORK';
  cloakedBridgeUrl: string;
  keyFeatures: string[];
}): Promise<{ success: boolean; article?: ParasiteSeoArticle; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const gate = await enforceCommercialFeatureForUser(user.id, 'growth_triad_bandit_kelly');
    if (!gate.ok) {
      return { success: false, error: 'FEATURE_LOCKED' };
    }

    const article = await createAndDispatchParasiteArticle(user.id, input);
    return { success: true, article };
  } catch (err) {
    logger.error('[triad-execution-actions] Syndicate parasite article failed', err instanceof Error ? err : undefined);
    return { success: false, error: 'FAILED_TO_SYNDICATE_ARTICLE' };
  }
}
