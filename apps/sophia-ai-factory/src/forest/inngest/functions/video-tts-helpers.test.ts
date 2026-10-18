import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  createServerClient: vi.fn(),
  from: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({ inngest: { send: mocks.send } }));
vi.mock('@/seed/db/client', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: { info: mocks.info } }));

import {
  emitProgress,
  fetchVideoJobForSynthesis,
  fetchVideoJobForTransition,
  markVideoJobTtsPending,
  saveVideoJobAudioKey,
} from './video-tts-helpers';

const query = {
  select: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
};

describe('video TTS helper operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.select.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.single.mockResolvedValue({
      data: { status: 'scripted', script_text: 'Hello', prompt: 'Narrate this', audio_r2_key: null },
    });
    mocks.from.mockReturnValue(query);
    mocks.createServerClient.mockReturnValue({ from: mocks.from });
    mocks.send.mockResolvedValue({ ids: ['event-1'] });
  });

  it('emits the SSE progress event with a stable event ID and timestamp', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);

    await emitProgress('campaign-1', 'tts', 45, 'Generating narration');

    expect(mocks.send).toHaveBeenCalledWith({
      id: 'progress-campaign-1-tts-1234',
      name: 'campaign.progress',
      data: {
        type: 'campaign.progress', campaignId: 'campaign-1', step: 'tts',
        progress: 45, message: 'Generating narration', timestamp: 1234,
      },
    });
    expect(mocks.info).toHaveBeenCalledWith('[videoTTS] Progress emitted', {
      campaignId: 'campaign-1', step: 'tts', progress: 45, message: 'Generating narration',
    });
  });

  it('loads a transition row scoped by both job ID and tenant ID', async () => {
    await expect(fetchVideoJobForTransition('job-1', 'tenant-1')).resolves.toEqual({
      status: 'scripted', script_text: 'Hello', prompt: 'Narrate this', audio_r2_key: null,
    });

    expect(mocks.from).toHaveBeenCalledWith('video_jobs');
    expect(query.select).toHaveBeenCalledWith('status, script_text, prompt, audio_r2_key');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'job-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'tenant_id', 'tenant-1');
  });

  it('rejects transition lookups when the job does not exist in the tenant', async () => {
    query.single.mockResolvedValueOnce({ data: null });

    await expect(fetchVideoJobForTransition('job-missing', 'tenant-1'))
      .rejects.toThrow('[videoTTS] Job not found: job-missing');
  });

  it('marks the job TTS pending and records the update timestamp', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(9_876_543);

    await markVideoJobTtsPending('job-2');

    expect(query.update).toHaveBeenCalledWith({ status: 'tts_pending', updated_at: 9876 });
    expect(query.eq).toHaveBeenCalledWith('id', 'job-2');
  });

  it('loads only synthesis fields and rejects missing jobs', async () => {
    query.single.mockResolvedValueOnce({ data: null });

    await expect(fetchVideoJobForSynthesis('job-3'))
      .rejects.toThrow('[videoTTS] Job not found during synthesis: job-3');
    expect(query.select).toHaveBeenCalledWith('script_text, prompt, audio_r2_key');
    expect(query.eq).toHaveBeenCalledWith('id', 'job-3');
  });

  it('saves the generated audio key and update timestamp', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(12_345_000);

    await saveVideoJobAudioKey('job-4', 'audio/tenant-1/job-4.mp3');

    expect(query.update).toHaveBeenCalledWith({
      audio_r2_key: 'audio/tenant-1/job-4.mp3', updated_at: 12_345,
    });
    expect(query.eq).toHaveBeenCalledWith('id', 'job-4');
  });
});
