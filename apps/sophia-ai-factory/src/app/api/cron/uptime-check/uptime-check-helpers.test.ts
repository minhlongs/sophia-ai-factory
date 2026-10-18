import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logger: { warn: vi.fn() },
  recordCheck: vi.fn(),
  getRecentChecks: vi.fn(),
  getActiveIncident: vi.fn(),
  openIncident: vi.fn(),
  closeIncident: vi.fn(),
  shouldAllowRequest: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  classifyError: vi.fn((error: unknown) => error instanceof Error ? 'network_error' : 'unknown_error'),
  classifyHttpStatus: vi.fn((status: number) => `http_${status}`),
  evaluateIncidentAction: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }));
vi.mock('@/seed/utils/to-error', () => ({
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));
vi.mock('@/land/status/status-store', () => ({
  recordCheck: mocks.recordCheck,
  getRecentChecks: mocks.getRecentChecks,
  getActiveIncident: mocks.getActiveIncident,
  openIncident: mocks.openIncident,
  closeIncident: mocks.closeIncident,
}));
vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: mocks.shouldAllowRequest,
  recordSuccess: mocks.recordSuccess,
  recordFailure: mocks.recordFailure,
}));
vi.mock('@/seed/types/failure-kind', () => ({
  classifyError: mocks.classifyError,
  classifyHttpStatus: mocks.classifyHttpStatus,
}));
vi.mock('@/land/status/incident-state-machine', () => ({
  evaluateIncidentAction: mocks.evaluateIncidentAction,
}));

const loadHelpers = () => import('./uptime-check-helpers');

describe('uptime-check helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('ADMIN_TELEGRAM_CHAT_ID', 'admin-chat');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubGlobal('fetch', vi.fn());
    mocks.shouldAllowRequest.mockReturnValue(true);
    mocks.recordCheck.mockResolvedValue(undefined);
    mocks.getRecentChecks.mockResolvedValue([{ status: 'down' }]);
    mocks.getActiveIncident.mockResolvedValue(null);
    mocks.evaluateIncidentAction.mockReturnValue('noop');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('skips Telegram alerting when admin configuration is absent', async () => {
    vi.stubEnv('ADMIN_TELEGRAM_CHAT_ID', '');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    const { alertAdmin } = await loadHelpers();

    await alertAdmin('incident');

    expect(mocks.logger.warn).toHaveBeenCalledWith('[uptime-check] No admin Telegram config — alert skipped');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('records a successful Telegram delivery', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    const { alertAdmin, CRON_NAME, HEALTH_URL, IDEMPOTENCY_WINDOW_MS, LATENCY_WARN_MS } = await loadHelpers();

    await alertAdmin('incident');

    expect(CRON_NAME).toBe('uptime-check');
    expect(HEALTH_URL).toContain('/api/health');
    expect(IDEMPOTENCY_WINDOW_MS).toBe(120_000);
    expect(LATENCY_WARN_MS).toBe(5_000);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('admin-chat') }),
    );
    expect(mocks.recordSuccess).toHaveBeenCalledWith('telegram-uptime-alert');
  });

  it('records a Telegram HTTP failure without throwing', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('rate limited', { status: 429 }));
    const { alertAdmin } = await loadHelpers();

    await expect(alertAdmin('incident')).resolves.toBeUndefined();

    expect(mocks.classifyHttpStatus).toHaveBeenCalledWith(429);
    expect(mocks.recordFailure).toHaveBeenCalledWith('telegram-uptime-alert', 'http_429');
  });

  it('records a transport failure but rethrows when the circuit is open', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('socket closed'));
    const { alertAdmin } = await loadHelpers();

    await alertAdmin('incident');

    expect(mocks.classifyError).toHaveBeenCalledWith(expect.objectContaining({ message: 'socket closed' }));
    expect(mocks.recordFailure).toHaveBeenCalledWith('telegram-uptime-alert', 'network_error');

    mocks.shouldAllowRequest.mockReturnValue(false);
    await expect(alertAdmin('incident')).rejects.toThrow('[circuit-breaker] Circuit open');
  });

  it('opens an incident after recording a down health check', async () => {
    mocks.evaluateIncidentAction.mockReturnValue('open');
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    const db = {} as D1Database;
    const { recordHealthStatusAndEvaluateIncident } = await loadHelpers();

    await recordHealthStatusAndEvaluateIncident(db, 'down', 8_250, 503);

    expect(mocks.recordCheck).toHaveBeenCalledWith(db, expect.objectContaining({ status: 'down', latencyMs: 8_250 }));
    expect(mocks.openIncident).toHaveBeenCalledWith(db, 'Service disruption detected', 'minor');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('closes an active incident on recovery and leaves inactive incidents alone', async () => {
    const db = {} as D1Database;
    const incident = { id: 'incident-17' };
    mocks.evaluateIncidentAction.mockReturnValue('close');
    mocks.getActiveIncident.mockResolvedValueOnce(incident).mockResolvedValueOnce(null);
    const { recordHealthStatusAndEvaluateIncident } = await loadHelpers();

    await recordHealthStatusAndEvaluateIncident(db, 'ok', 42, 200);
    await recordHealthStatusAndEvaluateIncident(db, 'ok', 38, 200);

    expect(mocks.closeIncident).toHaveBeenCalledTimes(1);
    expect(mocks.closeIncident).toHaveBeenCalledWith(db, 'incident-17');
    expect(mocks.openIncident).not.toHaveBeenCalled();
  });

  it('treats health status persistence failures as non-fatal', async () => {
    mocks.recordCheck.mockRejectedValue(new Error('D1 unavailable'));
    const { recordHealthStatusAndEvaluateIncident } = await loadHelpers();

    await expect(recordHealthStatusAndEvaluateIncident({} as D1Database, 'ok', 12, 200)).resolves.toBeUndefined();

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      '[uptime-check] Status record failed (non-fatal)',
      { error: 'D1 unavailable' },
    );
  });

  it('records unreachable health checks and opens a major incident when warranted', async () => {
    mocks.evaluateIncidentAction.mockReturnValue('open');
    const db = {} as D1Database;
    const { recordUnreachableStatusAndIncident } = await loadHelpers();

    await recordUnreachableStatusAndIncident(db, 'connection refused');

    expect(mocks.recordCheck).toHaveBeenCalledWith(db, expect.objectContaining({
      status: 'down', latencyMs: null, error: 'connection refused',
    }));
    expect(mocks.openIncident).toHaveBeenCalledWith(db, 'Service unreachable', 'major');
  });

  it('swallows unreachable-status persistence failures', async () => {
    mocks.recordCheck.mockRejectedValue(new Error('write failed'));
    const { recordUnreachableStatusAndIncident } = await loadHelpers();

    await expect(recordUnreachableStatusAndIncident({} as D1Database, 'offline')).resolves.toBeUndefined();
    expect(mocks.getRecentChecks).not.toHaveBeenCalled();
  });
});
