import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runStage, resumePoint, resetFrom, type CheckpointStore, type Checkpoint, type GenerationStage } from '../recovery-checkpoint';

describe('recovery-checkpoint', () => {
  let store: CheckpointStore;
  let jobId: string;

  beforeEach(() => {
    jobId = 'job-' + Math.random().toString(36).slice(2, 8);
    store = {
      getGenerationCheckpoint: vi.fn().mockResolvedValue(null),
      saveGenerationCheckpoint: vi.fn().mockResolvedValue(undefined),
      deleteGenerationCheckpoints: vi.fn().mockResolvedValue(undefined),
      getGenerationJob: vi.fn().mockResolvedValue(null),
    };
  });

  describe('runStage', () => {
    it('runs stage and saves checkpoint', async () => {
      const result = await runStage(store, jobId, 'strategy', async () => ({ topic: 'Python' }));
      expect(result).toEqual({ topic: 'Python' });
      expect(store.saveGenerationCheckpoint).toHaveBeenCalled();
    });

    it('saves failure checkpoint on error', async () => {
      await expect(
        runStage(store, jobId, 'script', async () => { throw new Error('fail'); })
      ).rejects.toThrow('fail');
      expect(store.saveGenerationCheckpoint).toHaveBeenCalled();
    });

    it('records timing information', async () => {
      await runStage(store, jobId, 'seo', async () => ({ title: 'test', description: 'desc', tags: ['a'] }));
      expect(store.saveGenerationCheckpoint).toHaveBeenCalled();
    });

    it('records error timing', async () => {
      await expect(
        runStage(store, jobId, 'production', async () => { throw new Error('timeout'); })
      ).rejects.toThrow('timeout');
      expect(store.saveGenerationCheckpoint).toHaveBeenCalled();
    });
  });

  describe('resumePoint', () => {
    it('returns first non-completed stage for empty checkpoints', () => {
      const result = resumePoint([]);
      expect(result).toBe('strategy');
    });

    it('returns quality_review when all stages completed', () => {
      const checkpoints: Checkpoint[] = [
        { stage: 'strategy', status: 'completed' },
        { stage: 'script', status: 'completed' },
        { stage: 'thumbnail', status: 'completed' },
        { stage: 'seo', status: 'completed' },
        { stage: 'production', status: 'completed' },
        { stage: 'quality_review', status: 'completed' },
      ];
      expect(resumePoint(checkpoints)).toBe('quality_review');
    });

    it('returns failed stage for retry', () => {
      const checkpoints: Checkpoint[] = [
        { stage: 'strategy', status: 'completed' },
        { stage: 'script', status: 'failed' },
      ];
      expect(resumePoint(checkpoints)).toBe('script');
    });
  });

  describe('resetFrom', () => {
    it('clears specified stage and all later stages', async () => {
      await resetFrom(store, jobId, 'script');
      expect(store.deleteGenerationCheckpoints).toHaveBeenCalledWith(
        jobId,
        ['script', 'thumbnail', 'seo', 'production', 'quality_review'],
      );
    });
  });
});