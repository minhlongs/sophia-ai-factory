import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const circuit = vi.hoisted(() => ({
  shouldAllowRequest: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: circuit.shouldAllowRequest,
  recordSuccess: circuit.recordSuccess,
  recordFailure: circuit.recordFailure,
}));

vi.mock('@/seed/utils/logger-utility', () => ({ logger: circuit.logger }));

import { listHeyGenWebhooks, unregisterHeyGenWebhook } from './heygen-registrar-helpers';

describe('HeyGen registrar helpers', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    circuit.shouldAllowRequest.mockReturnValue(true);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('lists endpoint aliases and normalizes missing event arrays', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: [
        { endpoint_id: 17, url: 'https://hooks.example/one', events: ['avatar_video.success'] },
        { id: 'legacy-id', url: 'https://hooks.example/two' },
      ],
    }), { status: 200 }));

    await expect(listHeyGenWebhooks('api-key')).resolves.toEqual({ success: true, endpoints: [
      { endpointId: '17', url: 'https://hooks.example/one', events: ['avatar_video.success'] },
      { endpointId: 'legacy-id', url: 'https://hooks.example/two', events: [] },
    ] });
    expect(fetchMock).toHaveBeenCalledWith('https://api.heygen.com/v1/webhook/endpoint.list', {
      headers: { 'X-Api-Key': 'api-key' },
    });
    expect(circuit.recordSuccess).toHaveBeenCalledWith('heygen');
  });

  it('falls back across response fields and records list failures without throwing', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'permission denied' }), { status: 403 }));
    await expect(listHeyGenWebhooks('bad-key')).resolves.toEqual({ success: false, error: 'permission denied' });
    expect(circuit.recordFailure).toHaveBeenCalledWith('heygen', expect.any(String));

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 503 }));
    await expect(listHeyGenWebhooks('bad-key')).resolves.toEqual({ success: false, error: 'HTTP 503' });
  });

  it('returns a fail-soft result for list network and JSON errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(listHeyGenWebhooks('api-key')).resolves.toEqual({ success: false, error: 'network unavailable' });

    fetchMock.mockResolvedValueOnce(new Response('not-json', { status: 200 }));
    await expect(listHeyGenWebhooks('api-key')).resolves.toMatchObject({ success: false });
    expect(circuit.logger.error).toHaveBeenCalledTimes(2);
  });

  it('blocks list and delete calls while the provider circuit is open', async () => {
    circuit.shouldAllowRequest.mockReturnValue(false);
    await expect(listHeyGenWebhooks('api-key')).resolves.toMatchObject({ success: false, error: expect.stringContaining('Circuit breaker open') });
    await expect(unregisterHeyGenWebhook('api-key', 'endpoint-1')).resolves.toMatchObject({ success: false, error: expect.stringContaining('Circuit breaker open') });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes endpoint with the expected request and records success', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(unregisterHeyGenWebhook('api-key', 'endpoint-1')).resolves.toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith('https://api.heygen.com/v1/webhook/endpoint.delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': 'api-key' },
      body: JSON.stringify({ endpoint_id: 'endpoint-1' }),
    });
    expect(circuit.recordSuccess).toHaveBeenCalledWith('heygen');
  });

  it('returns delete API and transport failures without throwing', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'endpoint missing' }), { status: 404 }));
    await expect(unregisterHeyGenWebhook('api-key', 'missing')).resolves.toEqual({ success: false, error: 'endpoint missing' });

    fetchMock.mockRejectedValueOnce(new Error('socket reset'));
    await expect(unregisterHeyGenWebhook('api-key', 'endpoint-1')).resolves.toEqual({ success: false, error: 'socket reset' });
    expect(circuit.recordFailure).toHaveBeenCalledTimes(2);
  });
});
