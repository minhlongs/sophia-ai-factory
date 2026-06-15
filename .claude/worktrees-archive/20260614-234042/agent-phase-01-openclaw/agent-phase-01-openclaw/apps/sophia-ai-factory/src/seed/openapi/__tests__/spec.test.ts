/**
 * Tests for OpenAPI 3.1 spec — structural integrity, refs resolve, required fields present.
 */

import { describe, it, expect } from 'vitest';
import { OPENAPI_SPEC } from '../spec';

interface SchemaWithRef {
  $ref?: string;
}

interface ResponseDefinition {
  description?: string;
  content?: Record<string, { schema?: SchemaWithRef }>;
  $ref?: string;
}

interface OperationDefinition {
  operationId?: string;
  summary?: string;
  security?: Array<Record<string, string[]>>;
  responses?: Record<string, ResponseDefinition>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: SchemaWithRef }>;
  };
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function* iterateOperations(spec: typeof OPENAPI_SPEC): Generator<{
  path: string;
  method: string;
  op: OperationDefinition;
}> {
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const op = (methods as Record<string, OperationDefinition>)[method];
      if (op) yield { path, method, op };
    }
  }
}

describe('OpenAPI v1 spec', () => {
  it('reports OpenAPI 3.1.0', () => {
    expect(OPENAPI_SPEC.openapi).toBe('3.1.0');
  });

  it('has a non-empty production server URL', () => {
    expect(OPENAPI_SPEC.servers.length).toBeGreaterThan(0);
    expect(OPENAPI_SPEC.servers[0].url).toMatch(/^https:\/\//);
  });

  it('documents at least the 6 baseline customer-facing endpoints', () => {
    const paths = Object.keys(OPENAPI_SPEC.paths);
    expect(paths).toContain('/api/v1/missions');
    expect(paths).toContain('/api/v1/missions/{id}');
    expect(paths).toContain('/api/v1/missions/{id}/generate-video');
    expect(paths).toContain('/api/v1/usage');
    expect(paths).toContain('/api/voice-presets');
    expect(paths).toContain('/api/video-templates');
  });

  it('every operation has operationId, summary, and at least one response', () => {
    for (const { op, path, method } of iterateOperations(OPENAPI_SPEC)) {
      expect(op.operationId, `${method} ${path} missing operationId`).toBeTruthy();
      expect(op.summary, `${method} ${path} missing summary`).toBeTruthy();
      expect(Object.keys(op.responses ?? {}).length, `${method} ${path} missing responses`).toBeGreaterThan(0);
    }
  });

  it('every operation declares a security scheme', () => {
    for (const { op, path, method } of iterateOperations(OPENAPI_SPEC)) {
      expect(op.security?.length, `${method} ${path} missing security`).toBeGreaterThan(0);
    }
  });

  it('declares apiKey + session security schemes', () => {
    expect(OPENAPI_SPEC.components.securitySchemes).toHaveProperty('apiKey');
    expect(OPENAPI_SPEC.components.securitySchemes).toHaveProperty('session');
  });

  it('declares all referenced schemas in components.schemas', () => {
    const schemas = OPENAPI_SPEC.components.schemas;
    for (const name of [
      'Mission',
      'CreateMissionRequest',
      'GenerateVideoRequest',
      'UsageRecord',
      'VoicePreset',
      'VideoTemplate',
      'ErrorEnvelope',
    ]) {
      expect(schemas, `missing schema ${name}`).toHaveProperty(name);
    }
  });

  it('is JSON-serialisable (no circular references)', () => {
    expect(() => JSON.stringify(OPENAPI_SPEC)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(OPENAPI_SPEC));
    expect(parsed.openapi).toBe('3.1.0');
  });

  it('all $ref pointers resolve to declared schemas or responses', () => {
    const json = JSON.stringify(OPENAPI_SPEC);
    const refs = json.match(/"\$ref":"[^"]+"/g) ?? [];
    const components = OPENAPI_SPEC.components as Record<string, unknown>;
    const schemaNames = new Set(Object.keys(components.schemas as Record<string, unknown>));
    const responseNames = new Set(
      Object.keys((components.responses as Record<string, unknown> | undefined) ?? {}),
    );

    for (const ref of refs) {
      const target = ref.replace(/^.*"#\/components\//, '').replace(/"$/, '');
      const [bucket, name] = target.split('/');
      if (bucket === 'schemas') {
        expect(schemaNames.has(name), `Unresolved schema ref: ${name}`).toBe(true);
      } else if (bucket === 'responses') {
        expect(responseNames.has(name), `Unresolved response ref: ${name}`).toBe(true);
      } else {
        throw new Error(`Unknown $ref bucket: ${bucket}`);
      }
    }
  });
});
