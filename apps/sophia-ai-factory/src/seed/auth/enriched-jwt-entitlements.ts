/**
 * Feature entitlements and limits by tier for Enriched JWT
 * @module auth/enriched-jwt-entitlements
 */

import { getAccessibleFeatures } from '@/lib/features'
import type { FeatureLimit } from '@/seed/auth/enriched-jwt-types'

export function getDefaultEntitlements(tier: string): string[] {
  const tierMap: Record<string, 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'> = {
    'free': 'BASIC', 'basic': 'BASIC', 'pro': 'PREMIUM',
    'premium': 'PREMIUM', 'enterprise': 'ENTERPRISE', 'master': 'MASTER',
  }
  const mappedTier = tierMap[tier.toLowerCase()] || 'BASIC'
  const features = getAccessibleFeatures(mappedTier)
  const featureKeys: string[] = [
    'heygen.createVideo', 'heygen.getVideoStatus',
    'elevenlabs.synthesize', 'elevenlabs.getAudioStatus',
    'openrouter.chat', 'openrouter.complete',
  ]
  if (['PREMIUM', 'ENTERPRISE', 'MASTER'].includes(mappedTier)) {
    featureKeys.push('affiliate.engine', 'roi.calculator', 'analytics.basic')
  }
  if (['ENTERPRISE', 'MASTER'].includes(mappedTier)) {
    featureKeys.push('api.integrations', 'auto.update', 'admin.dashboard', 'analytics.advanced')
  }
  if (mappedTier === 'MASTER') {
    featureKeys.push('white.label', 'custom.branding', 'priority.support')
  }
  return [...featureKeys, ...features.map(f => f.replace('enable_', ''))]
}

export function getFeatureLimits(tier: string): Record<string, FeatureLimit> {
  const limits: Record<string, FeatureLimit> = {
    'heygen.createVideo': { daily_limit: 10, monthly_limit: 100, max_tokens: 5000 },
    'elevenlabs.synthesize': { daily_limit: 20, monthly_limit: 200, max_tokens: 10000 },
    'openrouter.chat': { daily_limit: 100, monthly_limit: 1000, max_tokens: 50000 },
  }
  if (['PREMIUM', 'ENTERPRISE', 'MASTER'].includes(tier.toUpperCase())) {
    limits['heygen.createVideo'] = { daily_limit: 50, monthly_limit: 500, max_tokens: 10000 }
    limits['elevenlabs.synthesize'] = { daily_limit: 100, monthly_limit: 1000, max_tokens: 25000 }
    limits['openrouter.chat'] = { daily_limit: 500, monthly_limit: 5000, max_tokens: 100000 }
  }
  if (['ENTERPRISE', 'MASTER'].includes(tier.toUpperCase())) {
    limits['heygen.createVideo'] = { daily_limit: 200, monthly_limit: 2000, max_tokens: 25000 }
    limits['elevenlabs.synthesize'] = { daily_limit: 500, monthly_limit: 5000, max_tokens: 100000 }
    limits['openrouter.chat'] = { daily_limit: 2000, monthly_limit: 20000, max_tokens: 500000 }
  }
  if (tier.toUpperCase() === 'MASTER') {
    limits['heygen.createVideo'] = { monthly_limit: 10000 }
    limits['elevenlabs.synthesize'] = { monthly_limit: 20000 }
    limits['openrouter.chat'] = { monthly_limit: 100000 }
  }
  return limits
}
