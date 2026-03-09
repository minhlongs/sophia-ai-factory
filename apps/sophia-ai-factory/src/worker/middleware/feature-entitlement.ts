/**
 * Feature Entitlement Service for Cloudflare Worker
 * Maps endpoints to feature keys and validates access control
 *
 * @module worker/middleware/feature-entitlement
 */

/**
 * Endpoint to feature key mapping
 * Maps URL path patterns to required feature entitlements
 */
export interface EndpointFeatureMap {
  [pathPattern: string]: string;  // '/api/heygen/*' -> 'heygen.createVideo'
}

/**
 * Endpoint feature mapping configuration
 * Defines which features are required for each API endpoint
 */
export const ENDPOINT_FEATURE_MAP: EndpointFeatureMap = {
  // HeyGen video features
  '/api/heygen/create': 'heygen.createVideo',
  '/api/heygen/video/*': 'heygen.createVideo',
  '/api/heygen/status': 'heygen.getVideoStatus',
  '/api/heygen/templates': 'heygen.listTemplates',
  '/api/heygen/avatars': 'heygen.listAvatars',

  // ElevenLabs audio features
  '/api/elevenlabs/synthesize': 'elevenlabs.synthesize',
  '/api/elevenlabs/audio/*': 'elevenlabs.synthesize',
  '/api/elevenlabs/status': 'elevenlabs.getAudioStatus',
  '/api/elevenlabs/voices': 'elevenlabs.listVoices',
  '/api/elevenlabs/models': 'elevenlabs.listModels',

  // OpenRouter LLM features
  '/api/openrouter/chat': 'openrouter.chat',
  '/api/openrouter/complete': 'openrouter.complete',
  '/api/openrouter/models': 'openrouter.listModels',
  '/api/openrouter/tokenize': 'openrouter.tokenize',

  // Analytics features
  '/api/analytics/dashboard': 'analytics.basic',
  '/api/analytics/reports': 'analytics.advanced',
  '/api/analytics/export': 'analytics.advanced',
  '/api/analytics/roi': 'roi.calculator',

  // Affiliate features
  '/api/affiliate/link': 'affiliate.engine',
  '/api/affiliate/tracking': 'affiliate.engine',
  '/api/affiliate/commissions': 'affiliate.engine',

  // API integration features
  '/api/integrations/*': 'api.integrations',
  '/api/webhooks/*': 'api.integrations',

  // Auto-update features
  '/api/auto/update': 'auto.update',
  '/api/auto/sync': 'auto.update',

  // Admin dashboard features
  '/api/admin/*': 'admin.dashboard',
  '/admin/*': 'admin.dashboard',

  // White label features
  '/api/branding/*': 'white.label',
  '/api/custom/domain': 'white.label',
  '/api/custom/smtp': 'white.label',

  // Priority support
  '/api/support/priority': 'priority.support',
};

/**
 * Default features for each tier
 * Used as fallback when entitlements are not available
 */
export const TIER_DEFAULT_FEATURES: Record<string, string[]> = {
  BASIC: [
    'heygen.createVideo',
    'heygen.getVideoStatus',
    'elevenlabs.synthesize',
    'elevenlabs.getAudioStatus',
    'openrouter.chat',
    'openrouter.complete',
  ],
  PREMIUM: [
    'heygen.createVideo',
    'heygen.getVideoStatus',
    'heygen.listTemplates',
    'heygen.listAvatars',
    'elevenlabs.synthesize',
    'elevenlabs.getAudioStatus',
    'elevenlabs.listVoices',
    'elevenlabs.listModels',
    'openrouter.chat',
    'openrouter.complete',
    'openrouter.listModels',
    'affiliate.engine',
    'roi.calculator',
    'analytics.basic',
  ],
  ENTERPRISE: [
    'heygen.createVideo',
    'heygen.getVideoStatus',
    'heygen.listTemplates',
    'heygen.listAvatars',
    'elevenlabs.synthesize',
    'elevenlabs.getAudioStatus',
    'elevenlabs.listVoices',
    'elevenlabs.listModels',
    'openrouter.chat',
    'openrouter.complete',
    'openrouter.listModels',
    'openrouter.tokenize',
    'affiliate.engine',
    'roi.calculator',
    'analytics.basic',
    'analytics.advanced',
    'api.integrations',
    'auto.update',
    'admin.dashboard',
  ],
  MASTER: [
    'heygen.createVideo',
    'heygen.getVideoStatus',
    'heygen.listTemplates',
    'heygen.listAvatars',
    'elevenlabs.synthesize',
    'elevenlabs.getAudioStatus',
    'elevenlabs.listVoices',
    'elevenlabs.listModels',
    'openrouter.chat',
    'openrouter.complete',
    'openrouter.listModels',
    'openrouter.tokenize',
    'affiliate.engine',
    'roi.calculator',
    'analytics.basic',
    'analytics.advanced',
    'api.integrations',
    'auto.update',
    'admin.dashboard',
    'white.label',
    'custom.branding',
    'priority.support',
  ],
};

/**
 * Convert path pattern to RegExp for matching
 * Handles wildcards (*) in patterns
 *
 * @param pattern - Path pattern (e.g., '/api/heygen/*')
 * @returns RegExp for matching
 */
function patternToRegExp(pattern: string): RegExp {
  // Escape special regex chars except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  // Convert * to .* for wildcard matching
  const regexified = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${regexified}$`);
}

/**
 * Get required feature for a given path
 * Matches path against endpoint feature map
 *
 * @param pathname - Request path (e.g., '/api/heygen/create')
 * @returns Required feature key or null if no match
 */
export function getRequiredFeature(pathname: string): string | null {
  // Normalize pathname
  const normalizedPath = pathname.split('?')[0]; // Remove query params

  // Try exact match first
  if (ENDPOINT_FEATURE_MAP[normalizedPath]) {
    return ENDPOINT_FEATURE_MAP[normalizedPath];
  }

  // Try pattern matching
  for (const [pattern, feature] of Object.entries(ENDPOINT_FEATURE_MAP)) {
    if (pattern.includes('*')) {
      const regex = patternToRegExp(pattern);
      if (regex.test(normalizedPath)) {
        return feature;
      }
    }
  }

  // No feature required (public endpoint)
  return null;
}

/**
 * Validate if feature is in user's entitlements
 *
 * @param featureKey - Feature to check (e.g., 'heygen.createVideo')
 * @param entitlements - User's feature entitlements array
 * @returns true if feature is entitled
 */
export function validateFeatureAccess(
  featureKey: string,
  entitlements: string[]
): boolean {
  if (!featureKey) {
    return true; // No feature required = access granted
  }

  if (!entitlements || entitlements.length === 0) {
    return false; // No entitlements = no access
  }

  return entitlements.includes(featureKey);
}

/**
 * Get default features for tier
 *
 * @param tier - User tier (BASIC, PREMIUM, ENTERPRISE, MASTER)
 * @returns Array of default feature keys for tier
 */
export function getDefaultFeaturesForTier(tier: string): string[] {
  const normalizedTier = tier.toUpperCase();
  return TIER_DEFAULT_FEATURES[normalizedTier] || TIER_DEFAULT_FEATURES.BASIC;
}

/**
 * Check if tier is eligible for overage billing
 * Only ENTERPRISE and MASTER tiers can be charged overage fees
 *
 * @param tier - User tier
 * @returns true if overage billing is allowed
 */
export function isTierEligibleForOverage(tier: string): boolean {
  const normalizedTier = tier.toUpperCase();
  return normalizedTier === 'ENTERPRISE' || normalizedTier === 'MASTER';
}

/**
 * Merge multiple feature lists (for users with multiple entitlements)
 *
 * @param featureLists - Array of feature arrays to merge
 * @returns Deduplicated merged feature list
 */
export function mergeFeatureEntitlements(...featureLists: string[][]): string[] {
  const merged = new Set<string>();

  for (const list of featureLists) {
    for (const feature of list) {
      merged.add(feature);
    }
  }

  return Array.from(merged);
}

/**
 * Get feature metadata (for error messages and UI)
 *
 * @param featureKey - Feature identifier
 * @returns Feature metadata
 */
export function getFeatureMetadata(featureKey: string): {
  name: string;
  description: string;
  category: string;
} {
  const metadata: Record<string, { name: string; description: string; category: string }> = {
    // HeyGen
    'heygen.createVideo': {
      name: 'Create Video',
      description: 'Generate AI videos with HeyGen',
      category: 'heygen',
    },
    'heygen.getVideoStatus': {
      name: 'Video Status',
      description: 'Check video generation status',
      category: 'heygen',
    },
    'heygen.listTemplates': {
      name: 'List Templates',
      description: 'Browse HeyGen video templates',
      category: 'heygen',
    },
    'heygen.listAvatars': {
      name: 'List Avatars',
      description: 'Browse HeyGen AI avatars',
      category: 'heygen',
    },

    // ElevenLabs
    'elevenlabs.synthesize': {
      name: 'Synthesize Audio',
      description: 'Generate AI voice with ElevenLabs',
      category: 'elevenlabs',
    },
    'elevenlabs.getAudioStatus': {
      name: 'Audio Status',
      description: 'Check audio generation status',
      category: 'elevenlabs',
    },
    'elevenlabs.listVoices': {
      name: 'List Voices',
      description: 'Browse ElevenLabs voice library',
      category: 'elevenlabs',
    },
    'elevenlabs.listModels': {
      name: 'List Models',
      description: 'Browse ElevenLabs AI models',
      category: 'elevenlabs',
    },

    // OpenRouter
    'openrouter.chat': {
      name: 'Chat Completion',
      description: 'Send chat messages to LLM',
      category: 'openrouter',
    },
    'openrouter.complete': {
      name: 'Text Completion',
      description: 'Generate text completions',
      category: 'openrouter',
    },
    'openrouter.listModels': {
      name: 'List Models',
      description: 'Browse available LLM models',
      category: 'openrouter',
    },
    'openrouter.tokenize': {
      name: 'Tokenize',
      description: 'Count tokens for text',
      category: 'openrouter',
    },

    // Analytics
    'analytics.basic': {
      name: 'Basic Analytics',
      description: 'View basic usage analytics',
      category: 'analytics',
    },
    'analytics.advanced': {
      name: 'Advanced Analytics',
      description: 'Access advanced analytics and reports',
      category: 'analytics',
    },

    // ROI
    'roi.calculator': {
      name: 'ROI Calculator',
      description: 'Calculate return on investment',
      category: 'analytics',
    },

    // Affiliate
    'affiliate.engine': {
      name: 'Affiliate System',
      description: 'Manage affiliate links and tracking',
      category: 'affiliate',
    },

    // API
    'api.integrations': {
      name: 'API Integrations',
      description: 'Connect external APIs and webhooks',
      category: 'integration',
    },

    // Auto-update
    'auto.update': {
      name: 'Auto Update',
      description: 'Automatic content updates',
      category: 'automation',
    },

    // Admin
    'admin.dashboard': {
      name: 'Admin Dashboard',
      description: 'Access admin panel',
      category: 'admin',
    },

    // White label
    'white.label': {
      name: 'White Label',
      description: 'Custom branding and domains',
      category: 'branding',
    },
    'custom.branding': {
      name: 'Custom Branding',
      description: 'Custom logos and colors',
      category: 'branding',
    },

    // Support
    'priority.support': {
      name: 'Priority Support',
      description: 'Get priority customer support',
      category: 'support',
    },
  };

  return (
    metadata[featureKey] || {
      name: featureKey,
      description: `Feature: ${featureKey}`,
      category: 'other',
    }
  );
}
