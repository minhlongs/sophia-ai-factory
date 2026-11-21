// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
const sendOpsAlert = vi.hoisted(() => vi.fn());
vi.mock('@/seed/observability/ops-alert', () => ({ sendOpsAlert }));
vi.mock('@/tree/byok/resolve-user-api-key', () => ({ resolveUserApiKey: vi.fn() }));
vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn(), recordSuccess: vi.fn(), recordFailure: vi.fn(),
}));
import { sendTelegram } from './dispatchers';

describe('error digest operations notification', () => {
  it('never forwards report/model output and preserves honest delivery result', async () => {
    sendOpsAlert.mockResolvedValue({ sent: false, reason: 'timeout' });
    expect(await sendTelegram('private report with raw exception/token/customer@email.invalid'))
      .toEqual({ sent: false, reason: 'timeout' });
    expect(sendOpsAlert).toHaveBeenCalledExactlyOnceWith({ severity: 'medium', eventType: 'error_digest' });
  });
});
