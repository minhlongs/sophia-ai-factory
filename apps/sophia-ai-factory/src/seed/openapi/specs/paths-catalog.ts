/**
 * OpenAPI Path Specs: Catalog (Voice & Video Templates)
 *
 * Layer: seed/openapi
 */

export const CATALOG_PATHS: Record<string, Record<string, unknown>> = {
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
};
