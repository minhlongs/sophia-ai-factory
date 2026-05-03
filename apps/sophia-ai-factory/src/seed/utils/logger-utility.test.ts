import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/seed/utils/logger-utility';

describe('logger-utility — overloaded error-arg signatures', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
    debugSpy.mockRestore();
  });

  const parseOutput = (spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> => {
    const first = spy.mock.calls[0]?.[0];
    if (typeof first !== 'string') throw new Error('expected formatted string');
    try {
      return JSON.parse(first) as Record<string, unknown>;
    } catch {
      // dev-mode pretty print — return raw as string container
      return { raw: first };
    }
  };

  it('warn preserves Error name/message/stack when Error passed at arg2', () => {
    const boom = new Error('polar billing fetch failed');
    logger.warn('[Enriched JWT] Failed to fetch Polar billing status', boom);

    expect(warnSpy).toHaveBeenCalledOnce();
    const out = parseOutput(warnSpy);
    const err = (out.error ?? (out.raw as string)) as Record<string, unknown> | string;
    if (typeof err === 'string') {
      expect(err).toContain('polar billing fetch failed');
    } else {
      expect(err.name).toBe('Error');
      expect(err.message).toBe('polar billing fetch failed');
      expect(typeof err.stack).toBe('string');
    }
  });

  it('info accepts Error at arg2 and propagates to structured output', () => {
    const note = new Error('migration note');
    logger.info('migration succeeded with warning', note);

    expect(logSpy).toHaveBeenCalledOnce();
    const out = parseOutput(logSpy);
    const err = (out.error ?? (out.raw as string)) as Record<string, unknown> | string;
    if (typeof err === 'string') {
      expect(err).toContain('migration note');
    } else {
      expect(err.message).toBe('migration note');
    }
  });

  it('debug accepts Error at arg2 (output suppressed unless NODE_ENV=development)', () => {
    const dev = new Error('debug probe');
    logger.debug('debug attempt', dev);
    // Just ensure no throw — debug is dev-only; either 0 or 1 call is acceptable
    expect(debugSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('warn retains metadata-only legacy form (no Error param)', () => {
    logger.warn('plain metadata warn', { foo: 'bar', count: 3 });
    expect(warnSpy).toHaveBeenCalledOnce();
    const out = parseOutput(warnSpy);
    const meta = (out.metadata ?? (out.raw as string)) as Record<string, unknown> | string;
    if (typeof meta === 'string') {
      expect(meta).toContain('foo');
    } else {
      expect(meta.foo).toBe('bar');
      expect(meta.count).toBe(3);
    }
  });

  it('error still works via legacy (message, Error) form', () => {
    const boom = new Error('legacy path');
    logger.error('error path', boom);
    expect(errorSpy).toHaveBeenCalledOnce();
    const out = parseOutput(errorSpy);
    const err = (out.error ?? (out.raw as string)) as Record<string, unknown> | string;
    if (typeof err === 'string') {
      expect(err).toContain('legacy path');
    } else {
      expect(err.message).toBe('legacy path');
    }
  });

  it('warn new-form embedded error: { error, ...meta }', () => {
    const boom = new Error('embedded form');
    logger.warn('new form warn', { error: boom, userId: 'u-123' });
    expect(warnSpy).toHaveBeenCalledOnce();
    const out = parseOutput(warnSpy);
    const err = (out.error ?? (out.raw as string)) as Record<string, unknown> | string;
    if (typeof err === 'string') {
      expect(err).toContain('embedded form');
    } else {
      expect(err.message).toBe('embedded form');
    }
  });

  it('error with string-valued { error: "..." } preserves the value in metadata (no silent drop)', () => {
    logger.error('payment webhook rejected', { error: 'signature mismatch' });
    expect(errorSpy).toHaveBeenCalledOnce();
    const out = parseOutput(errorSpy);
    // metadata should carry the string error value intact
    const meta = (out.metadata ?? (out.raw as string)) as Record<string, unknown> | string;
    if (typeof meta === 'string') {
      expect(meta).toContain('signature mismatch');
    } else {
      expect(meta.error).toBe('signature mismatch');
    }
  });

  it('error with { error: string, ...meta } keeps both string error and sibling metadata', () => {
    logger.error('d1 write failed', { error: 'constraint violation', userId: 'u-9' });
    expect(errorSpy).toHaveBeenCalledOnce();
    const out = parseOutput(errorSpy);
    const meta = (out.metadata ?? (out.raw as string)) as Record<string, unknown> | string;
    if (typeof meta === 'string') {
      expect(meta).toContain('constraint violation');
      expect(meta).toContain('u-9');
    } else {
      expect(meta.error).toBe('constraint violation');
      expect(meta.userId).toBe('u-9');
    }
  });

  it('Phase 25 — picks up code/details/hint from PostgrestError-shaped Error', () => {
    const pgErr = Object.assign(new Error('relation "users" does not exist'), {
      code: '42P01',
      details: 'Schema public scanned',
      hint: 'Did you mean table "user"?',
    });
    logger.error('db query failed', pgErr);
    expect(errorSpy).toHaveBeenCalledOnce();
    const out = parseOutput(errorSpy);
    const err = (out.error ?? (out.raw as string)) as Record<string, unknown> | string;
    if (typeof err === 'string') {
      expect(err).toContain('42P01');
      expect(err).toContain('Schema public scanned');
    } else {
      expect(err.message).toBe('relation "users" does not exist');
      expect(err.code).toBe('42P01');
      expect(err.details).toBe('Schema public scanned');
      expect(err.hint).toBe('Did you mean table "user"?');
    }
  });

  it('Phase 25 — partial PostgrestError (only code) outputs only that extra field', () => {
    const pgErr = Object.assign(new Error('permission denied'), { code: '42501' });
    logger.error('rls blocked', pgErr);
    expect(errorSpy).toHaveBeenCalledOnce();
    const out = parseOutput(errorSpy);
    const err = (out.error ?? (out.raw as string)) as Record<string, unknown> | string;
    if (typeof err === 'string') {
      expect(err).toContain('42501');
    } else {
      expect(err.code).toBe('42501');
      expect('details' in err).toBe(false);
      expect('hint' in err).toBe(false);
    }
  });

  it('Phase 25 — plain Error (no extras) keeps output shape unchanged', () => {
    logger.error('plain error', new Error('classic'));
    expect(errorSpy).toHaveBeenCalledOnce();
    const out = parseOutput(errorSpy);
    const err = (out.error ?? (out.raw as string)) as Record<string, unknown> | string;
    if (typeof err === 'string') {
      expect(err).toContain('classic');
    } else {
      expect(err.message).toBe('classic');
      expect('code' in err).toBe(false);
      expect('details' in err).toBe(false);
      expect('hint' in err).toBe(false);
    }
  });

  it('warn with { error: string } preserves value at warn level too', () => {
    logger.warn('rate-limit probe', { error: 'throttled', retryAfter: 30 });
    expect(warnSpy).toHaveBeenCalledOnce();
    const out = parseOutput(warnSpy);
    const meta = (out.metadata ?? (out.raw as string)) as Record<string, unknown> | string;
    if (typeof meta === 'string') {
      expect(meta).toContain('throttled');
    } else {
      expect(meta.error).toBe('throttled');
      expect(meta.retryAfter).toBe(30);
    }
  });
});
