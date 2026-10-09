import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  submitPostPublishFeedbackAction,
  getFeedbackSummaryAction,
} from '../feedback-actions';
import * as authModule from '@/seed/auth/better-auth-session';
import * as coordinatorModule from '../feedback-coordinator';

describe('Land v15: Feedback Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized requests', async () => {
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue(null);

    const res = await submitPostPublishFeedbackAction({});
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('validates schema and calls coordinator for authenticated user', async () => {
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue({
      id: 'usr-1',
      email: 'founder@sophia.io',
      role: 'user',
    } as unknown as Awaited<ReturnType<typeof authModule.getCurrentUser>>);

    vi.spyOn(coordinatorModule, 'ingestPostPublishFeedback').mockResolvedValue(true);

    const validPayload = {
      id: 'fb-002',
      userId: 'usr-1',
      videoManifestId: 'vm-002',
      channelId: 'ch-002',
      platform: 'TIKTOK',
      views: 5000,
      watchTimeSeconds: 150000,
      durationSeconds: 30,
      retentionCurve: [
        { timePct: 0, retentionPct: 100 },
        { timePct: 100, retentionPct: 60 },
      ],
      collectedAt: 1728460000000,
    };

    const res = await submitPostPublishFeedbackAction(validPayload);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.ingested).toBe(true);
    }
  });

  it('retrieves feedback summary for authenticated user', async () => {
    vi.spyOn(authModule, 'getCurrentUser').mockResolvedValue({
      id: 'usr-1',
      email: 'founder@sophia.io',
      role: 'user',
    } as unknown as Awaited<ReturnType<typeof authModule.getCurrentUser>>);

    vi.spyOn(coordinatorModule, 'getFeedbackSummary').mockResolvedValue({
      totalFeedbacksIngested: 10,
      averageNormalizedRetention: 0.81,
      highPerformersIdentified: 7,
      lastUpdated: 1728480000000,
    });

    const res = await getFeedbackSummaryAction();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.totalFeedbacksIngested).toBe(10);
      expect(res.value.averageNormalizedRetention).toBe(0.81);
    }
  });
});
