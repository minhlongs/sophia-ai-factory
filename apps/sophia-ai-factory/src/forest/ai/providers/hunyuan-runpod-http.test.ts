import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoRenderInput } from '@/seed/ai/multimodal-provider-interface';

const circuit = vi.hoisted(() => ({
  shouldAllowRequest: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: circuit.shouldAllowRequest,
  recordSuccess: circuit.recordSuccess,
  recordFailure: circuit.recordFailure,
}));

import { executeRunpodRender, executeRunpodStatusCheck } from './hunyuan-runpod-http';

const params = {
  apiKey: 'runpod-key',
  endpointId: 'endpoint-1',
  baseUrl: 'https://api.runpod.ai/v2',
  effectiveKeyRef: 'user-credential',
};

function response(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), { status });
}

describe('Hunyuan Runpod HTTP helpers', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    circuit.shouldAllowRequest.mockReturnValue(true);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('sends script, duration, face, and audio to the render endpoint', async () => {
    fetchMock.mockResolvedValue(response({ id: 'job-123' }));
    const input: VideoRenderInput = {
      script: 'A person walks into a cafe',
      faceUrl: 'https://assets.test/face.png',
      audioUrl: 'https://assets.test/audio.wav',
      options: { duration: 12 },
    };

    await expect(executeRunpodRender(params, input)).resolves.toEqual({ jobId: 'job-123' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.runpod.ai/v2/endpoint-1/run', {
      method: 'POST',
      headers: { Authorization: 'Bearer runpod-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {
        prompt: 'A person walks into a cafe', duration: 12,
        face_url: input.faceUrl, audio_url: input.audioUrl, fps: 30,
      } }),
    });
    expect(circuit.shouldAllowRequest).toHaveBeenCalledWith('runpod', 'user-credential');
    expect(circuit.recordSuccess).toHaveBeenCalledWith('runpod', 'user-credential');
  });

  it.each([
    [{ options: { topic: 'from topic' } }, 'from topic', 30],
    [{ options: { scenes: [{ prompt: 'from first scene' }] } }, 'from first scene', 30],
    [{ options: { scenes: [], duration: '20' } }, 'Cinematic photorealistic video', 30],
  ] as Array<[Partial<VideoRenderInput>, string, number]>)('uses fallback prompt/duration inputs', async (partial, prompt, duration) => {
    fetchMock.mockResolvedValue(response({ id: 'job-fallback' }));
    const input: VideoRenderInput = { faceUrl: 'face', audioUrl: 'audio', ...partial };
    await executeRunpodRender(params, input);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toMatchObject({ input: { prompt, duration } });
  });

  it('fails before fetch when the provider circuit is open', async () => {
    circuit.shouldAllowRequest.mockReturnValue(false);
    await expect(executeRunpodRender(params, { faceUrl: 'face', audioUrl: 'audio' }))
      .rejects.toThrow('Circuit breaker open for runpod (user-credential)');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(circuit.recordFailure).not.toHaveBeenCalled();
  });

  it('records an HTTP render failure once and preserves provider response text', async () => {
    fetchMock.mockResolvedValue(new Response('rate limited', { status: 429 }));
    await expect(executeRunpodRender(params, { faceUrl: 'face', audioUrl: 'audio' }))
      .rejects.toThrow('Runpod HunyuanVideo failed: 429 - rate limited');
    expect(circuit.recordFailure).toHaveBeenCalledTimes(1);
    expect(circuit.recordFailure).toHaveBeenCalledWith('runpod', expect.any(String), 'user-credential');
  });

  it('records network and invalid JSON failures and rethrows them', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(executeRunpodRender(params, { faceUrl: 'face', audioUrl: 'audio' })).rejects.toThrow('network unavailable');
    expect(circuit.recordFailure).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    circuit.shouldAllowRequest.mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(new Response('not-json', { status: 200 }));
    await expect(executeRunpodRender(params, { faceUrl: 'face', audioUrl: 'audio' })).rejects.toThrow();
    expect(circuit.recordFailure).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ status: 'IN_QUEUE' }, { status: 'pending' }],
    [{ status: 'IN_PROGRESS' }, { status: 'processing' }],
    [{ status: 'COMPLETED', output: { download_url: 'https://assets.test/video.mp4' } }, { status: 'completed', videoUrl: 'https://assets.test/video.mp4' }],
    [{ status: 'FAILED', error: 'render failed' }, { status: 'failed', error: 'render failed' }],
    [{ status: 'CANCELLED' }, { status: 'failed', error: 'Runpod job status: CANCELLED' }],
  ] as Array<[Record<string, unknown>, Record<string, unknown>]>)('maps Runpod status payloads', async (payload, expected) => {
    fetchMock.mockResolvedValue(response(payload));
    await expect(executeRunpodStatusCheck(params, 'job-123')).resolves.toEqual(expected);
    expect(fetchMock).toHaveBeenCalledWith('https://api.runpod.ai/v2/endpoint-1/status/job-123', {
      headers: { Authorization: 'Bearer runpod-key' },
    });
    expect(circuit.recordSuccess).toHaveBeenCalledWith('runpod', 'user-credential');
  });

  it('records an HTTP status-check failure once', async () => {
    fetchMock.mockResolvedValue(new Response('upstream failed', { status: 502 }));
    await expect(executeRunpodStatusCheck(params, 'job-123')).rejects.toThrow('Runpod checkStatus failed: 502 - upstream failed');
    expect(circuit.recordFailure).toHaveBeenCalledTimes(1);
  });
});
