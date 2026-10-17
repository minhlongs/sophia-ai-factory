/**
 * OpenAPI Path Specs: Mission Video Generation & Usage Batch Ingestion
 *
 * Layer: seed/openapi
 */

export const MISSION_VIDEO_USAGE_PATHS: Record<string, Record<string, unknown>> = {
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
};
