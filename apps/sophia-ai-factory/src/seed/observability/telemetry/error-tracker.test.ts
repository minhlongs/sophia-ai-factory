import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getErrorClassName } from '@/seed/utils/to-error';
import { fingerprintError, reportError } from './error-tracker';

const { errorLogMock } = vi.hoisted(() => ({
  errorLogMock: vi.fn(),
}));

vi.mock('./logger', () => ({
  logger: {
    error: errorLogMock,
  },
}));

vi.mock('./better-stack-client', () => ({
  pushFatalLog: vi.fn(async () => {}),
}));

describe('getErrorClassName & error-tracker minification safety', () => {
  beforeEach(() => {
    errorLogMock.mockReset();
  });

  it('prefers explicit err.name over minified constructor.name for custom Error subclasses', () => {
    class e extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'QuotaExceededError';
      }
    }

    const err = new e('Monthly quota exceeded');
    expect(err.constructor.name).toBe('e');
    expect(getErrorClassName(err)).toBe('QuotaExceededError');
  });

  it('preserves built-in error names and falls back to constructor.name when err.name is generic Error', () => {
    expect(getErrorClassName(new TypeError('bad arg'))).toBe('TypeError');
    expect(getErrorClassName(new Error('plain'))).toBe('Error');

    class UnnamedCustomError extends Error {}
    expect(getErrorClassName(new UnnamedCustomError('fallback'))).toBe('UnnamedCustomError');

    const nameless = new Error('no-name');
    Object.defineProperty(nameless, 'name', { value: '' });
    Object.defineProperty(nameless, 'constructor', { value: undefined });
    expect(getErrorClassName(nameless)).toBe('Error');
  });

  it('produces identical fingerprints for a custom Error class regardless of constructor name minification', async () => {
    class QuotaExceededError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'QuotaExceededError';
      }
    }
    class t extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'QuotaExceededError';
      }
    }

    const fpUnminified = await fingerprintError(new QuotaExceededError('  Limit reached  '));
    const fpMinified = await fingerprintError(new t('limit   reached'));
    expect(fpMinified).toBe(fpUnminified);
  });

  it('logs and persists explicit msg_class rather than minified constructor.name in reportError', async () => {
    class n extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'AuthSystemError';
      }
    }

    const bindArgs: unknown[][] = [];
    const env = {
      COMMIT_SHA: 'abc1234',
      DB: {
        prepare: () => ({
          bind: (...args: unknown[]) => {
            bindArgs.push(args);
            return { run: async () => ({ success: true }) };
          },
        }),
      },
    };

    await reportError(new n('D1 auth lookup failed'), { route: '/api/first-value' }, env);

    expect(errorLogMock).toHaveBeenCalledWith(
      '[error-tracker] D1 auth lookup failed',
      expect.objectContaining({
        msgClass: 'AuthSystemError',
        route: '/api/first-value',
      }),
    );
    expect(bindArgs).toHaveLength(1);
    expect(bindArgs[0][2]).toBe('AuthSystemError');
  });
});
