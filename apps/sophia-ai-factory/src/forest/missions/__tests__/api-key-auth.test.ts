/**
 * Unit tests: validateMissionApiKey — error taxonomy (M6)
 *
 * Covers all 4 errorType branches:
 *   1. missing_credentials — no key header + no session
 *   2. invalid_key         — key not found in DB
 *   3. inactive            — key found but is_active=false
 *   4. db_unreachable      — DB throws exception
 *   5. valid API key       — happy path
 *   6. cookie fallback     — no key header, session resolves userId
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockDbFrom,
  mockGetCurrentUser,
  mockLoggerError,
  mockForwardToSentry,
} = vi.hoisted(() => ({
  mockDbFrom: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockLoggerError: vi.fn(),
  mockForwardToSentry: vi.fn().mockResolvedValue(undefined),
}));

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ from: mockDbFrom }),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/observability/sentry-forwarder', () => ({
  forwardToSentry: mockForwardToSentry,
}));

vi.mock('@/tree/audit/crypto-utils', () => ({
  sha256: (s: string) => `hash:${s}`,
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import { validateMissionApiKey, apiKeyAuthErrorResponse } from '../api-key-auth';

// ── Chain builder ────────────────────────────────────────────────────────────

type MockRow = { user_id: string; is_active: boolean } | null;

function makeChain(row: MockRow, throws = false) {
  const single = throws
    ? vi.fn().mockRejectedValue(new Error('D1_CONNECTION_ERROR'))
    : vi.fn().mockResolvedValue({ data: row, error: null });

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('validateMissionApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(null); // default: no session
  });

  it('missing_credentials — no key + no session', async () => {
    const result = await validateMissionApiKey(null, null);

    expect(result.valid).toBe(false);
    expect(result.errorType).toBe('missing_credentials');
    expect(result.error).toContain('Missing API key');
    // Sentry tag fired
    expect(mockForwardToSentry).toHaveBeenCalledWith(
      expect.objectContaining({ tags: { 'auth.error_type': 'missing_credentials' } })
    );
  });

  it('invalid_key — key not found in DB', async () => {
    mockDbFrom.mockReturnValue(makeChain(null)); // no row

    const result = await validateMissionApiKey('Bearer sk-test-badkey', null);

    expect(result.valid).toBe(false);
    expect(result.errorType).toBe('invalid_key');
    expect(result.error).toBe('Invalid API key');
    expect(mockForwardToSentry).toHaveBeenCalledWith(
      expect.objectContaining({ tags: { 'auth.error_type': 'invalid_key' } })
    );
  });

  it('inactive — key found but is_active=false', async () => {
    mockDbFrom.mockReturnValue(makeChain({ user_id: 'u1', is_active: false }));

    const result = await validateMissionApiKey(null, 'sk-inactive');

    expect(result.valid).toBe(false);
    expect(result.errorType).toBe('inactive');
    expect(result.error).toBe('API key is inactive');
    expect(mockForwardToSentry).toHaveBeenCalledWith(
      expect.objectContaining({ tags: { 'auth.error_type': 'inactive' } })
    );
  });

  it('db_unreachable — DB throws exception', async () => {
    mockDbFrom.mockReturnValue(makeChain(null, /* throws= */ true));

    const result = await validateMissionApiKey('Bearer sk-anykey', null);

    expect(result.valid).toBe(false);
    expect(result.errorType).toBe('db_unreachable');
    expect(result.error).toBe('Authentication error');
    // logger.error should fire
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[ApiKeyAuth] Validation error',
      expect.any(Error)
    );
    // Sentry tag: db_unreachable (error level)
    expect(mockForwardToSentry).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        tags: { 'auth.error_type': 'db_unreachable' },
      })
    );
  });

  it('valid — active key returns ok:true + userId', async () => {
    mockDbFrom.mockReturnValue(makeChain({ user_id: 'user-abc', is_active: true }));

    const result = await validateMissionApiKey('Bearer sk-valid', null);

    expect(result.valid).toBe(true);
    expect(result.userId).toBe('user-abc');
    expect(result.errorType).toBeUndefined();
    expect(mockForwardToSentry).not.toHaveBeenCalled();
  });

  it('cookie fallback — no key header, session resolves userId', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'session-user-42' });

    const result = await validateMissionApiKey(null, null);

    expect(result.valid).toBe(true);
    expect(result.userId).toBe('session-user-42');
    expect(result.errorType).toBeUndefined();
    // DB never queried
    expect(mockDbFrom).not.toHaveBeenCalled();
  });

  it('cookie fallback error — session throws, returns missing_credentials', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('session_store_down'));

    const result = await validateMissionApiKey(null, null);

    expect(result.valid).toBe(false);
    expect(result.errorType).toBe('missing_credentials');
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[ApiKeyAuth] Session fallback error',
      expect.any(Error)
    );
  });

  it('x-api-key header accepted as alternative to Bearer', async () => {
    mockDbFrom.mockReturnValue(makeChain({ user_id: 'user-xyz', is_active: true }));

    const result = await validateMissionApiKey(null, 'sk-via-x-header');

    expect(result.valid).toBe(true);
    expect(result.userId).toBe('user-xyz');
  });
});

// ── apiKeyAuthErrorResponse ─────────────────────────────────────────────────

describe('apiKeyAuthErrorResponse', () => {
  it('returns 401 for invalid_key', () => {
    const res = apiKeyAuthErrorResponse({ valid: false, error: 'Invalid API key', errorType: 'invalid_key' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for missing_credentials', () => {
    const res = apiKeyAuthErrorResponse({ valid: false, error: 'Missing API key', errorType: 'missing_credentials' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for inactive', () => {
    const res = apiKeyAuthErrorResponse({ valid: false, error: 'API key is inactive', errorType: 'inactive' });
    expect(res.status).toBe(403);
  });

  it('returns 503 for db_unreachable', () => {
    const res = apiKeyAuthErrorResponse({ valid: false, error: 'Authentication error', errorType: 'db_unreachable' });
    expect(res.status).toBe(503);
  });

  it('returns 401 for undefined errorType (fallback)', () => {
    const res = apiKeyAuthErrorResponse({ valid: false, error: 'Auth failed' });
    expect(res.status).toBe(401);
  });
});
