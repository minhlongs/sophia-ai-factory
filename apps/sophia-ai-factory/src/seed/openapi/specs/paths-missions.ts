/**
 * OpenAPI Path Specs: Missions & Usage
 *
 * Layer: seed/openapi
 */

import { MISSION_VIDEO_USAGE_PATHS } from './paths-missions-usage';

export { MISSION_VIDEO_USAGE_PATHS };

export const MISSION_PATHS: Record<string, Record<string, unknown>> = {
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
  ...MISSION_VIDEO_USAGE_PATHS,
};
