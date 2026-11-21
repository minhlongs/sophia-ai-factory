// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatOpsAlert, OPS_ALERT_DEADLINE_MS, sendOpsAlert } from '../ops-alert';
const breaker = vi.hoisted(() => ({ shouldAllowRequest: vi.fn(), getState: vi.fn(), recordFailure: vi.fn(), recordSuccess: vi.fn() }));
const cloud = vi.hoisted(() => ({ getCloudflareContext: vi.fn() }));
vi.mock('@opennextjs/cloudflare', () => cloud);
vi.mock('@/seed/security/circuit-breaker', () => breaker);
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/seed/security/breaker/circuit-state-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/security/breaker/circuit-state-store')>();
  return { ...actual, persistToD1: vi.fn().mockResolvedValue(undefined) };
});
const alert = { severity: 'high', eventType: 'synthetic_fulfillment_stale' } as const;
const success = { ok: true, result: { message_id: 7, chat: { id: -10001 } } };
const reply = (json: unknown, status = 200) => new Response(JSON.stringify(json), { status });

describe('platform ops Telegram alert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cloud.getCloudflareContext.mockRejectedValue(new Error('not a Worker'));
    vi.stubEnv('OPS_ALERT_PROVIDER', 'telegram');
    vi.stubEnv('TELEGRAM_OPS_BOT_TOKEN', 'not-a-real-test-token');
    vi.stubEnv('TELEGRAM_OPS_CHAT_ID', '-10001');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(success)));
    breaker.shouldAllowRequest.mockReturnValue(true);
    breaker.getState.mockReturnValue({ state: 'CLOSED', cooldownUntil: null });
    breaker.recordFailure.mockReturnValue({ cooldownUntil: null });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it.each(['', 'disabled', 'slack', 'unexpected'])('defaults safely off for provider %s', async (provider) => {
    vi.stubEnv('OPS_ALERT_PROVIDER', provider);
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'disabled' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['TELEGRAM_OPS_BOT_TOKEN', 'TELEGRAM_OPS_CHAT_ID'])('missing %s is not delivered', async (key) => {
    vi.stubEnv(key, '');
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'unconfigured' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('honors Worker disabled config instead of inheriting local credentials', async () => {
    cloud.getCloudflareContext.mockResolvedValue({ env: { OPS_ALERT_PROVIDER: 'disabled' } });
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'disabled' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['../redirect', 'https://attacker.invalid'])('rejects malformed server config %s', async (token) => {
    vi.stubEnv('TELEGRAM_OPS_BOT_TOKEN', token);
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'unconfigured' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('locks destination, plain text, endpoint and ignores arbitrary payload fields', async () => {
    const result = await sendOpsAlert({ ...alert, chatId: 'attacker', reason: 'private@email.invalid',
      dashboard: 'https://attacker.invalid', incidentId: 'token:secret' } as typeof alert);
    expect(result).toEqual({ sent: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botnot-a-real-test-token/sendMessage');
    const payload = JSON.parse(String(init?.body));
    expect(payload.chat_id).toBe('-10001');
    expect(payload.parse_mode).toBeUndefined();
    expect(init?.redirect).toBe('error');
    expect(JSON.stringify(payload)).not.toMatch(/attacker|private|token:secret|Slack/);
    expect(payload.text).toContain('/vi/dashboard/admin');
    expect(breaker.recordSuccess).toHaveBeenCalledWith('telegram-ops');
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('keeps a UUID but discards oversized/raw incident references safely', () => {
    const id = '12345678-1234-1234-1234-123456789abc';
    expect(formatOpsAlert({ ...alert, incidentId: id })).toContain(id);
    const message = formatOpsAlert({ ...alert, incidentId: 'private'.repeat(5000) });
    expect(message.length).toBeLessThan(1000);
    expect(message).not.toContain('private');
    expect(message).toContain('Cảnh báo');
  });
  it('rejects invalid event labels before sending', async () => {
    expect(await sendOpsAlert({ ...alert, eventType: 'raw secret' } as unknown as typeof alert))
      .toEqual({ sent: false, reason: 'invalid_alert' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not bypass open circuit', async () => {
    breaker.shouldAllowRequest.mockReturnValue(false);
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'circuit_open' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([401, 403, 500])('reports HTTP %i honestly with no retry or Slack fallback', async (status) => {
    vi.mocked(fetch).mockResolvedValue(reply({ ok: false }, status));
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'http_error' });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('reports ok:false on HTTP 200', async () => {
    vi.mocked(fetch).mockResolvedValue(reply({ ok: false, error_code: 400, description: 'private' }));
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'rejected' });
  });
  it.each([{}, { ok: true }, { ok: true, result: { message_id: 0, chat: { id: -10001 } } },
    { ok: true, result: { message_id: 1, chat: { id: 999 } } }])('rejects incomplete or wrong-destination success %j', async (data) => {
    vi.mocked(fetch).mockResolvedValue(reply(data));
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'malformed_response' });
  });
  it('handles invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not json'));
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'malformed_response' });
  });
  it.each([200, 429])('preserves retry_after for rate limit HTTP %i without sleeping or retrying', async (status) => {
    const state = { state: 'CLOSED', cooldownUntil: null };
    breaker.recordFailure.mockReturnValue(state);
    vi.mocked(fetch).mockResolvedValue(reply({ ok: false, error_code: 429, parameters: { retry_after: 100000 } }, status));
    const now = Date.now();
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'rate_limited', retryAfterSeconds: 100000 });
    expect(state.cooldownUntil).toBeGreaterThanOrEqual(now + 100000000);
    expect(state.state).toBe('OPEN');
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('keeps valid retry_after even when other response fields are malformed and blocks repeated sends', async () => {
    vi.mocked(fetch).mockResolvedValue(reply({ parameters: { retry_after: 100000 } }, 429));
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'rate_limited', retryAfterSeconds: 100000 });
    breaker.shouldAllowRequest.mockReturnValue(false);
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'circuit_open' });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('retains the longest cooldown across five in-flight 429s and actual breaker threshold transitions', async () => {
    const actual = await vi.importActual<typeof import('@/seed/security/circuit-breaker')>(
      '@/seed/security/circuit-breaker');
    actual.reset('telegram-ops');
    breaker.getState.mockImplementation(actual.getState);
    breaker.recordFailure.mockImplementation(actual.recordFailure);
    breaker.shouldAllowRequest.mockImplementation(actual.shouldAllowRequest);
    const responses: Array<(response: Response) => void> = [];
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>((resolve) => responses.push(resolve)));
    try {
      const pending = [3600, 60, 60, 60, 60].map(() => sendOpsAlert(alert));
      await vi.waitFor(() => expect(responses).toHaveLength(5));
      const longestDeadline = Date.now() + 3600_000;
      for (const [index, retryAfter] of [3600, 60, 60, 60, 60].entries()) {
        responses[index](reply({ ok: false, error_code: 429, parameters: { retry_after: retryAfter } }, 429));
        expect(await pending[index]).toEqual({ sent: false, reason: 'rate_limited', retryAfterSeconds: retryAfter });
        const state = actual.getState('telegram-ops');
        expect(state.failureCount).toBe(index + 1);
        expect(state.state).toBe('OPEN');
        expect(state.cooldownUntil).toBeGreaterThanOrEqual(longestDeadline);
      }
      expect(actual.shouldAllowRequest('telegram-ops')).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(5);
    } finally {
      actual.reset('telegram-ops');
      breaker.getState.mockReset();
      breaker.recordFailure.mockReset();
      breaker.shouldAllowRequest.mockReset();
    }
  });
  it('preserves an active 429 cooldown across concurrent 401, 500, rejected, malformed and network failures', async () => {
    const actual = await vi.importActual<typeof import('@/seed/security/circuit-breaker')>(
      '@/seed/security/circuit-breaker');
    actual.reset('telegram-ops');
    breaker.getState.mockImplementation(actual.getState);
    breaker.recordFailure.mockImplementation(actual.recordFailure);
    breaker.shouldAllowRequest.mockImplementation(actual.shouldAllowRequest);
    const controls: Array<{ resolve: (r: Response) => void; reject: (e: Error) => void }> = [];
    vi.mocked(fetch).mockImplementation(
      () => new Promise<Response>((resolve, reject) => controls.push({ resolve, reject })));
    try {
      const pending = Array.from({ length: 6 }, () => sendOpsAlert(alert));
      await vi.waitFor(() => expect(controls).toHaveLength(6));
      const longestDeadline = Date.now() + 3600_000;
      controls[0].resolve(reply({ ok: false, error_code: 429, parameters: { retry_after: 3600 } }, 429));
      expect(await pending[0]).toEqual({ sent: false, reason: 'rate_limited', retryAfterSeconds: 3600 });
      controls[1].resolve(reply({ ok: false }, 401));
      expect(await pending[1]).toEqual({ sent: false, reason: 'http_error' });
      controls[2].resolve(reply({ ok: false }, 500));
      expect(await pending[2]).toEqual({ sent: false, reason: 'http_error' });
      controls[3].resolve(reply({ ok: false, error_code: 400 }, 200));
      expect(await pending[3]).toEqual({ sent: false, reason: 'rejected' });
      controls[4].resolve(new Response('not json', { status: 200 }));
      expect(await pending[4]).toEqual({ sent: false, reason: 'malformed_response' });
      controls[5].reject(new Error('network reset'));
      expect(await pending[5]).toEqual({ sent: false, reason: 'network_error' });
      const state = actual.getState('telegram-ops');
      expect(state.state).toBe('OPEN');
      expect(state.cooldownUntil).toBeGreaterThanOrEqual(longestDeadline);
      expect(actual.shouldAllowRequest('telegram-ops')).toBe(false);
    } finally {
      actual.reset('telegram-ops');
      breaker.getState.mockReset();
      breaker.recordFailure.mockReset();
      breaker.shouldAllowRequest.mockReset();
    }
  });
  it('uses conservative retry delay for malformed 429', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('invalid', { status: 429 }));
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'rate_limited', retryAfterSeconds: 60 });
  });
  it('does not clear a concurrent rate-limit cooldown after success', async () => {
    breaker.getState.mockReturnValue({ state: 'OPEN', cooldownUntil: Date.now() + 120000 });
    expect(await sendOpsAlert(alert)).toEqual({ sent: true });
    expect(breaker.recordSuccess).not.toHaveBeenCalled();
  });
  it('never exposes fetch exception URLs or tokens', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('https://api.telegram.org/botnot-a-real-test-token/sendMessage private'));
    expect(await sendOpsAlert(alert)).toEqual({ sent: false, reason: 'network_error' });
  });
  it('enforces deadline even if fetch ignores abort', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const result = sendOpsAlert(alert);
    await vi.advanceTimersByTimeAsync(OPS_ALERT_DEADLINE_MS + 1);
    expect(await result).toEqual({ sent: false, reason: 'timeout' });
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
