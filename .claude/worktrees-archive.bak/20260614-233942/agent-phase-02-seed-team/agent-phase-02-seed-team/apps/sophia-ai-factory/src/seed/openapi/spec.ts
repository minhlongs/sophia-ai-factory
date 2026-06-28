/**
 * Sophia v1 Public API — OpenAPI 3.1 specification.
 *
 * Hand-rolled baseline covering the customer-facing surface used by:
 *   - Power users (curl / postman / their own SDKs)
 *   - Zapier app authoring
 *   - External integrations (per Phase 07 GAP unlock)
 *
 * Internal/admin/cron endpoints are intentionally OMITTED — surface only what
 * customers should depend on. Add new paths with stable shapes; never break
 * an existing path's contract.
 *
 * Served at GET /api/openapi (content-type application/json).
 *
 * @module seed/openapi/spec
 */

export interface OpenApiSpec {
  openapi: '3.1.0';
  info: { title: string; version: string; description: string };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
}

export const OPENAPI_SPEC: OpenApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Sophia AI Factory — Public v1 API',
    version: '1.0.0',
    description:
      'Public REST API for the Sophia AI Factory. Customer-facing endpoints for missions, usage metering, and content catalogs. Internal/admin routes are out of scope.',
  },
  servers: [
    { url: 'https://sophia.agencyos.network', description: 'Production' },
  ],
  paths: {
    '/api/v1/missions': {
      post: {
        operationId: 'createMission',
        summary: 'Create a mission (async)',
        description:
          'Triggers the Inngest mission pipeline. Returns 202 with the new mission ID; poll GET /api/v1/missions/{id} or supply `webhook_url` for completion.',
        tags: ['Missions'],
        security: [{ apiKey: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateMissionRequest' },
            },
          },
        },
        responses: {
          '202': {
            description: 'Mission accepted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Mission' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '402': { description: 'Insufficient credits' },
          '429': { description: 'Rate limit exceeded' },
        },
      },
      get: {
        operationId: 'listMissions',
        summary: 'List missions',
        tags: ['Missions'],
        security: [{ apiKey: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'command', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Paginated mission list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    missions: { type: 'array', items: { $ref: '#/components/schemas/Mission' } },
                    nextCursor: { type: ['string', 'null'] },
                  },
                  required: ['missions'],
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/v1/missions/{id}': {
      get: {
        operationId: 'getMission',
        summary: 'Get a single mission',
        tags: ['Missions'],
        security: [{ apiKey: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Mission detail (includes result/error if completed)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Mission' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { description: 'Mission not found' },
        },
      },
    },
    '/api/v1/missions/{id}/generate-video': {
      post: {
        operationId: 'generateVideoForMission',
        summary: 'Trigger video generation for a mission',
        description:
          'Session-authenticated endpoint that queues an Inngest video generation job. Rate-limited at 5 req/min.',
        tags: ['Missions'],
        security: [{ session: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GenerateVideoRequest' },
            },
          },
        },
        responses: {
          '202': {
            description: 'Video generation queued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { jobId: { type: 'string' } },
                  required: ['jobId'],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { description: 'Mission not found' },
          '409': { description: 'Mission in blocked status (failed/cancelled)' },
        },
      },
    },
    '/api/v1/usage': {
      post: {
        operationId: 'ingestUsageBatch',
        summary: 'Batch ingest usage records',
        tags: ['Usage'],
        security: [{ session: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  records: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/UsageRecord' },
                  },
                },
                required: ['records'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Ingestion results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    accepted: { type: 'integer' },
                    rejected: { type: 'integer' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                  required: ['total', 'accepted', 'rejected'],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/voice-presets': {
      get: {
        operationId: 'listVoicePresets',
        summary: 'List voice presets accessible to the caller tier',
        tags: ['Catalog'],
        security: [{ session: [] }],
        responses: {
          '200': {
            description: 'Voice preset list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tier: { type: 'string' },
                    presets: { type: 'array', items: { $ref: '#/components/schemas/VoicePreset' } },
                  },
                  required: ['tier', 'presets'],
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/video-templates': {
      get: {
        operationId: 'listVideoTemplates',
        summary: 'List video template presets accessible to the caller tier',
        tags: ['Catalog'],
        security: [{ session: [] }],
        parameters: [
          {
            name: 'category',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['educational', 'marketing', 'social', 'brand'],
            },
          },
        ],
        responses: {
          '200': {
            description: 'Video template list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tier: { type: 'string' },
                    category: { type: ['string', 'null'] },
                    count: { type: 'integer' },
                    templates: { type: 'array', items: { $ref: '#/components/schemas/VideoTemplate' } },
                  },
                  required: ['tier', 'count', 'templates'],
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
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
        description: 'Better Auth session cookie (set after login).',
      },
    },
    schemas: {
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
    },
    // OpenAPI 3.1 allows reusable response objects under components.responses.
    // Stored on the same object for ergonomics; tools tolerate the extra key.
    ...({
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
    } as Record<string, unknown>),
  },
};
