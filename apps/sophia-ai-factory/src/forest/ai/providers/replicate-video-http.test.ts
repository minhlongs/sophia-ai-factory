import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  shouldAllowRequest: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  classifyHttpStatus: vi.fn((status: number) => `http_${status}`),
  classifyError: vi.fn((error: unknown) => error instanceof Error ? 'network_error' : 'unknown_error'),
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: mocks.shouldAllowRequest,
  recordSuccess: mocks.recordSuccess,
  recordFailure: mocks.recordFailure,
}));
vi.mock('@/seed/types/failure-kind', () => ({
  classifyHttpStatus: mocks.classifyHttpStatus,
  classifyError: mocks.classifyError,
}));

import {
  createReplicatePrediction,
  getReplicatePredictionStatus,
  type ReplicateEndpointConfig,
} from './replicate-video-http';

const config: ReplicateEndpointConfig = {
  apiKey: 'replicate-test-key',
  effectiveKeyRef: 'tenant-key-9',
  baseUrl: 'https://replicate.example/v1',
  modelOwner: 'sophia',
  modelName: 'video-model',
};

const input = {
  faceUrl: 'https://cdn.example/face.png',
  audioUrl: 'https://cdn.example/voice.wav',
  script: 'hello there',
  options: { fps: 24 },
};

describe('Replicate video HTTP helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldAllowRequest.mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it('creates a prediction with the expected request body and tenant circuit key', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ id: 'prediction-123' }));

    await expect(createReplicatePrediction(config, input)).resolves.toEqual({ jobId: 'prediction-123' });

    expect(mocks.shouldAllowRequest).toHaveBeenCalledWith('replicate', config.effectiveKeyRef);
    expect(fetch).toHaveBeenCalledWith(
      'https://replicate.example/v1/models/sophia/video-model/predictions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer replicate-test-key' }),
        body: JSON.stringify({ input: { face: input.faceUrl, audio: input.audioUrl, fps: 24 } }),
      }),
    );
    expect(mocks.recordSuccess).toHaveBeenCalledWith('replicate', config.effectiveKeyRef);
  });

  it('fails closed before creating a prediction when the circuit is open', async () => {
    mocks.shouldAllowRequest.mockReturnValue(false);

    await expect(createReplicatePrediction(config, input))
      .rejects.toThrow(`[Replicate] Circuit breaker open for replicate (${config.effectiveKeyRef})`);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.recordFailure).not.toHaveBeenCalled();
  });

  it('records a non-success HTTP response once and includes its body in the error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('model capacity exhausted', { status: 429 }));

    await expect(createReplicatePrediction(config, input))
      .rejects.toThrow('Replicate renderVideo failed: 429 - model capacity exhausted');

    expect(mocks.recordFailure).toHaveBeenCalledTimes(1);
    expect(mocks.recordFailure).toHaveBeenCalledWith('replicate', 'http_429', config.effectiveKeyRef);
    expect(mocks.classifyError).not.toHaveBeenCalled();
  });

  it('classifies network errors from prediction creation', async () => {
    const error = new Error('connection reset');
    vi.mocked(fetch).mockRejectedValue(error);

    await expect(createReplicatePrediction(config, input)).rejects.toBe(error);

    expect(mocks.classifyError).toHaveBeenCalledWith(error);
    expect(mocks.recordFailure).toHaveBeenCalledWith('replicate', 'network_error', config.effectiveKeyRef);
  });

  it.each([
    ['starting', 'pending'],
    ['processing', 'processing'],
    ['succeeded', 'completed'],
    ['failed', 'failed'],
    ['canceled', 'failed'],
    ['unknown-status', 'pending'],
  ] as const)('maps provider status %s to %s and accepts string output', async (providerStatus, expectedStatus) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({
      id: 'prediction-456', status: providerStatus, output: 'https://cdn.example/out.mp4', error: 'provider detail',
    }));

    await expect(getReplicatePredictionStatus(config, 'prediction-456')).resolves.toEqual({
      status: expectedStatus, videoUrl: 'https://cdn.example/out.mp4', error: 'provider detail',
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://replicate.example/v1/predictions/prediction-456',
      { headers: { Authorization: 'Bearer replicate-test-key' } },
    );
  });

  it('selects the first array output and tolerates an empty output list', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ id: 'p-1', status: 'succeeded', output: ['https://cdn.example/first.mp4', 'second'] }))
      .mockResolvedValueOnce(Response.json({ id: 'p-2', status: 'succeeded', output: [] }));

    await expect(getReplicatePredictionStatus(config, 'p-1')).resolves.toMatchObject({
      status: 'completed', videoUrl: 'https://cdn.example/first.mp4',
    });
    await expect(getReplicatePredictionStatus(config, 'p-2')).resolves.toMatchObject({
      status: 'completed', videoUrl: undefined,
    });
    expect(mocks.recordSuccess).toHaveBeenCalledTimes(2);
  });

  it('records a status HTTP failure once', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('prediction missing', { status: 404 }));

    await expect(getReplicatePredictionStatus(config, 'missing'))
      .rejects.toThrow('Replicate checkStatus failed: 404 - prediction missing');
    expect(mocks.recordFailure).toHaveBeenCalledTimes(1);
    expect(mocks.recordFailure).toHaveBeenCalledWith('replicate', 'http_404', config.effectiveKeyRef);
  });

  it('records a status JSON parsing failure and rethrows it', async () => {
    const error = new SyntaxError('invalid JSON');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockRejectedValue(error),
    } as unknown as Response);

    await expect(getReplicatePredictionStatus(config, 'bad-json')).rejects.toBe(error);
    expect(mocks.classifyError).toHaveBeenCalledWith(error);
    expect(mocks.recordFailure).toHaveBeenCalledWith('replicate', 'network_error', config.effectiveKeyRef);
  });
});
