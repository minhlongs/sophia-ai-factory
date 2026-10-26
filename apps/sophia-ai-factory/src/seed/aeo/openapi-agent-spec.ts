/**
 * OpenAPI 3.1 Static Public Agent Action Schema for Sophia AI Factory.
 * Serves zero-auth agent discovery contracts at /api/openapi.json.
 * Layer: seed/aeo
 */

import { SOPHIA_BASE_URL } from './ground-truth-catalog';

export function buildOpenApiAgentSpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Sophia AI Factory — Public Agent Action & Dual-Read API',
      version: '2027.1.0',
      description: 'Machine-readable OpenAPI 3.1 spec for AI agents, crawlers, and LLM clients.',
    },
    servers: [{ url: SOPHIA_BASE_URL, description: 'Cloudflare Workers Edge Production' }],
    paths: {
      '/llms.txt': {
        get: {
          summary: 'Concise LLM text index',
          responses: { '200': { description: 'Bilingual LLM corpus index in text/plain' } },
        },
      },
      '/llms-full.txt': {
        get: {
          summary: 'Full LLM ground truth markdown corpus',
          responses: { '200': { description: 'Complete documentation and 51 niches in text/markdown' } },
        },
      },
      '/.well-known/agent.json': {
        get: {
          summary: 'Agent Discovery Protocol manifest',
          responses: { '200': { description: 'Agent capability and tool manifest in application/json' } },
        },
      },
      '/api/aeo/markdown': {
        get: {
          summary: 'Dual-Read Markdown projection for any public route',
          parameters: [
            { name: 'path', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'locale', in: 'query', required: false, schema: { type: 'string', enum: ['vi', 'en'] } },
          ],
          responses: {
            '200': { description: 'Frontmatter Markdown with verified citation and comparison' },
            '404': { description: 'Non-negotiable or private path' },
          },
        },
      },
      '/api/version': {
        get: {
          summary: 'Edge deployment SHA verification',
          responses: { '200': { description: 'JSON containing shortSha, deployedAt, and opennextVersion' } },
        },
      },
      '/api/aeo/indexnow': {
        get: {
          summary: 'IndexNow deterministic key verification',
          responses: { '200': { description: 'Plain text key for search engine crawler verification' } },
        },
      },
    },
  };
}
