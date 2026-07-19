/**
 * Endpoint-feature maps and tier default features
 * @module worker/middleware/feature-entitlement-maps
 */

export interface EndpointFeatureMap {
  [pathPattern: string]: string
}

export const ENDPOINT_FEATURE_MAP: EndpointFeatureMap = {
  '/api/heygen/create': 'heygen.createVideo',
  '/api/heygen/video/*': 'heygen.createVideo',
  '/api/heygen/status': 'heygen.getVideoStatus',
  '/api/heygen/templates': 'heygen.listTemplates',
  '/api/heygen/avatars': 'heygen.listAvatars',
  '/api/elevenlabs/synthesize': 'elevenlabs.synthesize',
  '/api/elevenlabs/audio/*': 'elevenlabs.synthesize',
  '/api/elevenlabs/status': 'elevenlabs.getAudioStatus',
  '/api/elevenlabs/voices': 'elevenlabs.listVoices',
  '/api/elevenlabs/models': 'elevenlabs.listModels',
  '/api/openrouter/chat': 'openrouter.chat',
  '/api/openrouter/complete': 'openrouter.complete',
  '/api/openrouter/models': 'openrouter.listModels',
  '/api/openrouter/tokenize': 'openrouter.tokenize',
  '/api/analytics/dashboard': 'analytics.basic',
  '/api/analytics/reports': 'analytics.advanced',
  '/api/analytics/export': 'analytics.advanced',
  '/api/analytics/roi': 'roi.calculator',
  '/api/affiliate/link': 'affiliate.engine',
  '/api/affiliate/tracking': 'affiliate.engine',
  '/api/affiliate/commissions': 'affiliate.engine',
  '/api/integrations/*': 'api.integrations',
  '/api/webhooks/*': 'api.integrations',
  '/api/auto/update': 'auto.update',
  '/api/auto/sync': 'auto.update',
  '/api/admin/*': 'admin.dashboard',
  '/admin/*': 'admin.dashboard',
  '/api/branding/*': 'white.label',
  '/api/custom/domain': 'white.label',
  '/api/custom/smtp': 'white.label',
  '/api/support/priority': 'priority.support',
}

export const TIER_DEFAULT_FEATURES: Record<string, string[]> = {
  BASIC: [
    'heygen.createVideo', 'heygen.getVideoStatus',
    'elevenlabs.synthesize', 'elevenlabs.getAudioStatus',
    'openrouter.chat', 'openrouter.complete',
  ],
  PREMIUM: [
    'heygen.createVideo', 'heygen.getVideoStatus', 'heygen.listTemplates', 'heygen.listAvatars',
    'elevenlabs.synthesize', 'elevenlabs.getAudioStatus', 'elevenlabs.listVoices', 'elevenlabs.listModels',
    'openrouter.chat', 'openrouter.complete', 'openrouter.listModels',
    'affiliate.engine', 'roi.calculator', 'analytics.basic',
  ],
  ENTERPRISE: [
    'heygen.createVideo', 'heygen.getVideoStatus', 'heygen.listTemplates', 'heygen.listAvatars',
    'elevenlabs.synthesize', 'elevenlabs.getAudioStatus', 'elevenlabs.listVoices', 'elevenlabs.listModels',
    'openrouter.chat', 'openrouter.complete', 'openrouter.listModels', 'openrouter.tokenize',
    'affiliate.engine', 'roi.calculator', 'analytics.basic', 'analytics.advanced',
    'api.integrations', 'auto.update', 'admin.dashboard',
  ],
  MASTER: [
    'heygen.createVideo', 'heygen.getVideoStatus', 'heygen.listTemplates', 'heygen.listAvatars',
    'elevenlabs.synthesize', 'elevenlabs.getAudioStatus', 'elevenlabs.listVoices', 'elevenlabs.listModels',
    'openrouter.chat', 'openrouter.complete', 'openrouter.listModels', 'openrouter.tokenize',
    'affiliate.engine', 'roi.calculator', 'analytics.basic', 'analytics.advanced',
    'api.integrations', 'auto.update', 'admin.dashboard',
    'white.label', 'custom.branding', 'priority.support',
  ],
}
