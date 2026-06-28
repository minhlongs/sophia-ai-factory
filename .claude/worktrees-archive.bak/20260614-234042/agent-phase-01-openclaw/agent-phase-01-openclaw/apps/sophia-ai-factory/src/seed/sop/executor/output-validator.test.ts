/**
 * Tests: output-validator.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { validateOutput, clearValidatorCache } from './output-validator';

const SIMPLE_SCHEMA = JSON.stringify({
  type: 'object',
  required: ['emailId', 'reportId'],
  properties: {
    emailId: { type: 'string' },
    reportId: { type: 'string' },
    metricsSnapshot: { type: 'object' },
  },
});

const ARRAY_SCHEMA = JSON.stringify({
  type: 'object',
  required: ['videos', 'emailId'],
  properties: {
    videos: { type: 'array' },
    emailId: { type: 'string' },
  },
});

const APPROVAL_SCHEMA = JSON.stringify({
  type: 'object',
  required: ['draftId', 'requiresApproval'],
  properties: {
    draftId: { type: 'string' },
    requiresApproval: { type: 'boolean', const: true },
  },
});

describe('validateOutput', () => {
  beforeEach(() => clearValidatorCache());

  it('passes valid output with all required fields', () => {
    expect(() =>
      validateOutput({ emailId: 'e1', reportId: 'r1' }, SIMPLE_SCHEMA, 'tpl-1'),
    ).not.toThrow();
  });

  it('fails when required field is missing', () => {
    expect(() =>
      validateOutput({ emailId: 'e1' }, SIMPLE_SCHEMA, 'tpl-1'),
    ).toThrow(/reportId/);
  });

  it('fails when field has wrong type', () => {
    expect(() =>
      validateOutput({ emailId: 123, reportId: 'r1' }, SIMPLE_SCHEMA, 'tpl-1'),
    ).toThrow(/emailId/);
  });

  it('validates array type fields', () => {
    expect(() =>
      validateOutput({ videos: [{ id: 'v1' }], emailId: 'e1' }, ARRAY_SCHEMA, 'tpl-2'),
    ).not.toThrow();
  });

  it('fails when array field receives non-array', () => {
    expect(() =>
      validateOutput({ videos: 'not-an-array', emailId: 'e1' }, ARRAY_SCHEMA, 'tpl-2'),
    ).toThrow(/videos/);
  });

  it('passes valid requiresApproval: true', () => {
    expect(() =>
      validateOutput(
        { draftId: 'd1', requiresApproval: true },
        APPROVAL_SCHEMA,
        'tpl-3',
      ),
    ).not.toThrow();
  });

  it('uses cached validator on second call (no re-parse)', () => {
    // Two calls with same templateId — second should be a cache hit
    validateOutput({ emailId: 'e1', reportId: 'r1' }, SIMPLE_SCHEMA, 'cache-test');
    expect(() =>
      validateOutput({ emailId: 'e1', reportId: 'r1' }, SIMPLE_SCHEMA, 'cache-test'),
    ).not.toThrow();
  });

  it('handles invalid JSON schema gracefully (pass-through)', () => {
    // Invalid schema should not throw
    expect(() =>
      validateOutput({ anything: 'goes' }, 'INVALID JSON', 'tpl-bad'),
    ).not.toThrow();
  });

  it('fails when output is not an object', () => {
    expect(() =>
      validateOutput([] as unknown as Record<string, unknown>, SIMPLE_SCHEMA, 'tpl-arr'),
    ).toThrow(/JSON object/);
  });
});
