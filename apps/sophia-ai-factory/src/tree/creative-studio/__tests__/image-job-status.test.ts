/**
 * Status vocabulary tests.
 *
 * The invariant these protect: an unrecognised status must never be presented
 * as a finished artifact, and must never be reported as a failure either. A
 * provider state outside the known vocabulary is neither outcome, so it gets
 * its own stage.
 */

import { describe, it, expect } from 'vitest';
import {
  imageJobStage,
  normalizeImageJobStatus,
} from '../image-job-status';

describe('normalizeImageJobStatus', () => {
  it('keeps the statuses the backend writes', () => {
    for (const status of ['pending', 'processing', 'completed', 'failed']) {
      expect(normalizeImageJobStatus(status)).toBe(status);
    }
  });

  it('maps null and empty to unknown rather than assuming a state', () => {
    expect(normalizeImageJobStatus(null)).toBe('unknown');
    expect(normalizeImageJobStatus(undefined)).toBe('unknown');
    expect(normalizeImageJobStatus('')).toBe('unknown');
  });

  it('maps an unrecognised provider status to unknown', () => {
    expect(normalizeImageJobStatus('queued_by_provider')).toBe('unknown');
    expect(normalizeImageJobStatus('COMPLETED')).toBe('unknown');
  });
});

describe('imageJobStage', () => {
  it('groups backlog and work into distinct running states', () => {
    expect(imageJobStage('pending')).toBe('queued');
    expect(imageJobStage('processing')).toBe('running');
    expect(imageJobStage('completed')).toBe('done');
    expect(imageJobStage('failed')).toBe('failed');
  });

  it('never lets an unknown status read as done or as a failure', () => {
    // A provider state the vocabulary does not recognise is its own outcome.
    // It is not a completed artifact, and it is not a broken generation.
    expect(imageJobStage('unknown')).toBe('unknown');
    expect(imageJobStage('unknown')).not.toBe('done');
    expect(imageJobStage('unknown')).not.toBe('failed');
  });
});
