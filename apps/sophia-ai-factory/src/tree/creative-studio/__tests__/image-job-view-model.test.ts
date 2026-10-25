/**
 * View-model and fixture tests.
 *
 * The fixture set below doubles as the deterministic review states the
 * workspace is verified against locally; none of it reaches production.
 */

import { describe, it, expect } from 'vitest';
import {
  loadImageJobsForView,
  normaliseImageJobsForView,
} from '../image-job-view-model';
import { allowedImageModelsForTier } from '@/seed/config/tiers/image-model-access';
import type { ImageJobRow } from '../image-job-queries';

function row(overrides: Partial<ImageJobRow>): ImageJobRow {
  return {
    id: 'job_1',
    user_id: 'user_1',
    model: 'flux-schnell',
    prompt: 'a cat on a rooftop',
    status: 'completed',
    result_url: 'https://cdn.test/a.png',
    thumbnail_url: null,
    provider: 'muapi',
    error: null,
    created_at: 1700000000,
    completed_at: 1700000600,
    ...overrides,
  };
}

describe('loadImageJobsForView', () => {
  it('reports a failed read instead of returning an empty list', async () => {
    const result = await loadImageJobsForView(() => Promise.reject(new Error('D1 down')));

    expect(result.loadFailed).toBe(true);
  });

  it('reports success with the jobs on a good read', async () => {
    const result = await loadImageJobsForView(() =>
      Promise.resolve(normaliseImageJobsForView([row({})])),
    );

    expect(result.loadFailed).toBe(false);
    if (!result.loadFailed) {
      expect(result.jobs).toHaveLength(1);
    }
  });
});

describe('normaliseImageJobsForView', () => {
  it('maps snake_case columns to view fields', () => {
    const [job] = normaliseImageJobsForView([row({})]);

    expect(job).toMatchObject({
      id: 'job_1',
      stage: 'done',
      prompt: 'a cat on a rooftop',
      resultUrl: 'https://cdn.test/a.png',
      createdAt: 1700000000,
      completedAt: 1700000600,
    });
  });

  it('keeps a failed job in the list with its failure stage', () => {
    const [job] = normaliseImageJobsForView([
      row({ id: 'job_f', status: 'failed', result_url: null }),
    ]);

    expect(job.stage).toBe('failed');
    expect(job.resultUrl).toBeNull();
  });

  it('does not let a newer failure displace an older success', () => {
    const jobs = normaliseImageJobsForView([
      row({ id: 'new_failed', status: 'failed', result_url: null, created_at: 1700009000 }),
      row({ id: 'old_ok', status: 'completed', result_url: 'https://cdn.test/old.png' }),
    ]);

    expect(jobs).toHaveLength(2);
    expect(jobs.find((j) => j.id === 'old_ok')?.stage).toBe('done');
  });

  it('maps an in-flight job to a pollable stage', () => {
    const [job] = normaliseImageJobsForView([row({ status: 'processing' })]);
    expect(job.stage).toBe('running');
  });
});

describe('allowedImageModelsForTier', () => {
  it('gives every tier at least one model', () => {
    for (const tier of ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']) {
      expect(allowedImageModelsForTier(tier).length).toBeGreaterThan(0);
    }
  });

  it('keeps higher tiers a superset of lower ones', () => {
    const basic = new Set(allowedImageModelsForTier('BASIC'));
    for (const tier of ['PREMIUM', 'ENTERPRISE', 'MASTER']) {
      for (const model of basic) {
        expect(allowedImageModelsForTier(tier)).toContain(model);
      }
    }
  });

  it('falls back to the most restrictive tier for an unknown tier', () => {
    expect(allowedImageModelsForTier('SOMETHING_NEW')).toEqual(allowedImageModelsForTier('BASIC'));
  });
});
