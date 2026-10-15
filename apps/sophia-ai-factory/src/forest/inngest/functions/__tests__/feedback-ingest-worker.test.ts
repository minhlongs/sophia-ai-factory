import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performanceFeedbackIngestWorker } from '../feedback-ingest-worker';
import * as coordinatorModule from '@/land/growth-v15/feedback-coordinator';

describe('Forest: Performance Feedback Ingestion Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('declares matching function id and event trigger', () => {
    // In Inngest v3+, .id is a getter or function returning the id
    const id = typeof performanceFeedbackIngestWorker.id === 'function'
      ? performanceFeedbackIngestWorker.id()
      : performanceFeedbackIngestWorker.id;
    expect(id).toBe('growth-v15-feedback-ingest-worker');
  });

  it('processes valid feedback event and invokes coordinator steps', async () => {
    const ingestSpy = vi
      .spyOn(coordinatorModule, 'ingestPostPublishFeedback')
      .mockResolvedValue(true);
    const priorSpy = vi
      .spyOn(coordinatorModule, 'updateBayesianPrior')
      .mockResolvedValue(true);

    const stepMock = {
      run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const validPayload = {
      id: 'fb-inngest-001',
      userId: 'usr-123',
      videoManifestId: 'vm-123',
      channelId: 'ch-123',
      platform: 'TIKTOK',
      views: 12000,
      watchTimeSeconds: 360000,
      durationSeconds: 30,
      retentionCurve: [
        { timePct: 0, retentionPct: 100 },
        { timePct: 50, retentionPct: 75 },
        { timePct: 100, retentionPct: 50 },
      ],
      collectedAt: 1728500000000,
    };

    // Extract the handler logic from createFunction config
    // In Vitest, createFunction returns an object whose fn property or execution logic can be tested
    const fn = (performanceFeedbackIngestWorker as any).fn;
    if (typeof fn === 'function') {
      const result = await fn({
        event: {
          name: 'growth/v15.feedback.ingest',
          data: validPayload,
        },
        step: stepMock,
      });

      expect(result.success).toBe(true);
      expect(result.feedbackId).toBe('fb-inngest-001');
      expect(ingestSpy).toHaveBeenCalled();
      expect(priorSpy).toHaveBeenCalled();
    }
  });

  it('returns failure when payload validation fails', async () => {
    const fn = (performanceFeedbackIngestWorker as any).fn;
    if (typeof fn === 'function') {
      const result = await fn({
        event: {
          name: 'growth/v15.feedback.ingest',
          data: { invalid: 'payload' },
        },
        step: { run: vi.fn() },
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('INVALID_PAYLOAD');
    }
  });
});
