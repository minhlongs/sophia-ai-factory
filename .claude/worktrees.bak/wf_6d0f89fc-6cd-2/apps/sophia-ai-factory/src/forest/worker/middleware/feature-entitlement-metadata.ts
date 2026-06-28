/**
 * Feature metadata (names, descriptions, categories)
 * @module worker/middleware/feature-entitlement-metadata
 */

const FEATURE_METADATA: Record<string, { name: string; description: string; category: string }> = {
  'heygen.createVideo': { name: 'Create Video', description: 'Generate AI videos with HeyGen', category: 'heygen' },
  'heygen.getVideoStatus': { name: 'Video Status', description: 'Check video generation status', category: 'heygen' },
  'heygen.listTemplates': { name: 'List Templates', description: 'Browse HeyGen video templates', category: 'heygen' },
  'heygen.listAvatars': { name: 'List Avatars', description: 'Browse HeyGen AI avatars', category: 'heygen' },
  'elevenlabs.synthesize': { name: 'Synthesize Audio', description: 'Generate AI voice with ElevenLabs', category: 'elevenlabs' },
  'elevenlabs.getAudioStatus': { name: 'Audio Status', description: 'Check audio generation status', category: 'elevenlabs' },
  'elevenlabs.listVoices': { name: 'List Voices', description: 'Browse ElevenLabs voice library', category: 'elevenlabs' },
  'elevenlabs.listModels': { name: 'List Models', description: 'Browse ElevenLabs AI models', category: 'elevenlabs' },
  'openrouter.chat': { name: 'Chat Completion', description: 'Send chat messages to LLM', category: 'openrouter' },
  'openrouter.complete': { name: 'Text Completion', description: 'Generate text completions', category: 'openrouter' },
  'openrouter.listModels': { name: 'List Models', description: 'Browse available LLM models', category: 'openrouter' },
  'openrouter.tokenize': { name: 'Tokenize', description: 'Count tokens for text', category: 'openrouter' },
  'analytics.basic': { name: 'Basic Analytics', description: 'View basic usage analytics', category: 'analytics' },
  'analytics.advanced': { name: 'Advanced Analytics', description: 'Access advanced analytics and reports', category: 'analytics' },
  'roi.calculator': { name: 'ROI Calculator', description: 'Calculate return on investment', category: 'analytics' },
  'affiliate.engine': { name: 'Affiliate System', description: 'Manage affiliate links and tracking', category: 'affiliate' },
  'api.integrations': { name: 'API Integrations', description: 'Connect external APIs and webhooks', category: 'integration' },
  'auto.update': { name: 'Auto Update', description: 'Automatic content updates', category: 'automation' },
  'admin.dashboard': { name: 'Admin Dashboard', description: 'Access admin panel', category: 'admin' },
  'white.label': { name: 'White Label', description: 'Custom branding and domains', category: 'branding' },
  'custom.branding': { name: 'Custom Branding', description: 'Custom logos and colors', category: 'branding' },
  'priority.support': { name: 'Priority Support', description: 'Get priority customer support', category: 'support' },
}

export function getFeatureMetadata(featureKey: string): { name: string; description: string; category: string } {
  return FEATURE_METADATA[featureKey] || { name: featureKey, description: `Feature: ${featureKey}`, category: 'other' }
}
