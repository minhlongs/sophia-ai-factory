/**
 * OpenAPI Security Schemes and Reusable Schemas
 *
 * Layer: seed/openapi
 */

export const SECURITY_SCHEMES = {
  apiKey: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'sk_live_...',
    description: 'API key issued via /dashboard/api-keys.',
  },
  session: {
    type: 'apiKey',
    in: 'cookie',
    name: 'better-auth.session_token',
    description:
      'Better Auth session cookie. Derives __Secure- prefix from NODE_ENV via seed/auth/cookie-name.getSessionCookieName() during runtime; spec literal shows dev-mode value.',
  },
} as const;

export const SCHEMAS = {
  Mission: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      command: { type: 'string' },
      status: {
        type: 'string',
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
      },
      credits_used: { type: 'integer' },
      result: { type: ['object', 'null'] },
      error: { type: ['string', 'null'] },
      created_at: { type: 'integer', description: 'Unix seconds' },
      updated_at: { type: 'integer' },
      completed_at: { type: ['integer', 'null'] },
      webhook_url: { type: ['string', 'null'] },
    },
    required: ['id', 'command', 'status'],
  },
  CreateMissionRequest: {
    type: 'object',
    properties: {
      command: { type: 'string', minLength: 1, maxLength: 100 },
      params: { type: 'object', additionalProperties: true },
      webhook_url: { type: 'string', format: 'uri' },
    },
    required: ['command'],
  },
  GenerateVideoRequest: {
    type: 'object',
    properties: {
      prompt: { type: 'string', minLength: 1 },
      voiceoverText: { type: 'string' },
      aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'] },
      durationSec: { type: 'integer', minimum: 1 },
      language: { type: 'string', enum: ['en', 'vi'] },
    },
    required: ['prompt'],
  },
  UsageRecord: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      feature_key: { type: 'string', description: 'Dotted key, e.g. "video.render"' },
      timestamp: { type: 'integer' },
      consumed_units: { type: 'number', minimum: 0 },
      request_count: { type: 'integer', minimum: 1 },
      tokens_input: { type: 'integer', minimum: 0 },
      tokens_output: { type: 'integer', minimum: 0 },
    },
    required: ['tenant_id', 'feature_key', 'timestamp', 'consumed_units', 'request_count'],
  },
  VoicePreset: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      displayName: { type: 'string' },
      language: { type: 'string' },
      gender: { type: 'string', enum: ['male', 'female', 'neutral'] },
      vibe: { type: 'string' },
      samplePath: { type: 'string' },
      minTier: { type: 'string', enum: ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] },
    },
    required: ['id', 'displayName', 'language', 'minTier'],
  },
  VideoTemplate: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      displayName: { type: 'string' },
      category: { type: 'string', enum: ['educational', 'marketing', 'social', 'brand'] },
      aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5'] },
      durationSec: { type: 'integer' },
      vibe: { type: 'string' },
      samplePath: { type: 'string' },
      minTier: { type: 'string', enum: ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] },
    },
    required: ['id', 'displayName', 'category', 'minTier'],
  },
  ErrorEnvelope: {
    type: 'object',
    properties: {
      error: { type: 'string' },
      details: { type: 'object', additionalProperties: true },
    },
    required: ['error'],
  },
} as const;

export const OPENAPI_COMPONENTS = {
  securitySchemes: SECURITY_SCHEMES,
  schemas: SCHEMAS,
  responses: {
    Unauthorized: {
      description: 'Missing or invalid credentials',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        },
      },
    },
    ValidationError: {
      description: 'Request body or query failed validation',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorEnvelope' },
        },
      },
    },
  },
};
