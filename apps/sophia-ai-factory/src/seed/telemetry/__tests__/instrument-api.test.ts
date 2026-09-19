/**
 * Tests for API Route Instrumentation (`instrumentRoute`)
 *
 * Verifies:
 * - Span creation with HTTP method, route, component attributes
 * - HTTP status code recording on successful and error responses
 * - Error recording on uncaught handler exceptions without swallowing errors
 * - In-memory metrics ring buffer updating
 * - Non-blocking asynchronous execution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { instrumentRoute, createRouteSpan } from '../instrument-api';

// Mock getTracer and metrics
const mockSpan = {
  setAttribute: vi.fn(),
  setStatus: vi.fn(),
  recordException: vi.fn(),
  end: vi.fn(),
};

const mockTracer = {
  startSpan: vi.fn().mockReturnValue(mockSpan),
};

vi.mock('@/seed/telemetry/opentelemetry-setup', () => ({
  getTracer: vi.fn(() => mockTracer),
}));

const mockRecord = vi.fn();
vi.mock('@/seed/observability/telemetry/metrics', () => ({
  record: (...args: unknown[]) => mockRecord(...args),
}));

describe('instrumentRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('instruments successful route handler and records metrics', async () => {
    const handler = vi.fn().mockResolvedValue({ status: 200, data: 'ok' });
    const wrapped = instrumentRoute({ route: '/api/test', method: 'GET' }, handler);

    const result = await wrapped('arg1', 'arg2');

    expect(result).toEqual({ status: 200, data: 'ok' });
    expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    expect(mockTracer.startSpan).toHaveBeenCalledWith(
      'api.get..api.test',
      expect.objectContaining({
        attributes: {
          'http.method': 'GET',
          'http.route': '/api/test',
          component: 'api',
        },
      }),
    );
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 200);
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('duration_ms', expect.any(Number));
    expect(mockSpan.end).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenCalledWith('/api/test', expect.any(Number), false);
  });

  it('marks span as error and records error metric when status >= 400', async () => {
    const handler = vi.fn().mockResolvedValue({ status: 403, error: 'Forbidden' });
    const wrapped = instrumentRoute({ route: '/api/admin/secure', method: 'POST' }, handler);

    const result = await wrapped();

    expect(result).toEqual({ status: 403, error: 'Forbidden' });
    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: 1, // ERROR
      message: 'HTTP 403',
    });
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 403);
    expect(mockSpan.end).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenCalledWith('/api/admin/secure', expect.any(Number), true);
  });

  it('records exception and re-throws when route handler throws', async () => {
    const error = new Error('Database connection failed');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = instrumentRoute({ route: '/api/data', method: 'GET' }, handler);

    await expect(wrapped()).rejects.toThrow('Database connection failed');

    expect(mockSpan.recordException).toHaveBeenCalledWith(error);
    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: 1, // ERROR
      message: 'Database connection failed',
    });
    expect(mockSpan.end).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenCalledWith('/api/data', expect.any(Number), true);
  });

  it('createRouteSpan creates manual span with standardized attributes', () => {
    const span = createRouteSpan({ route: '/api/custom', method: 'PUT' });
    expect(span).toBe(mockSpan);
    expect(mockTracer.startSpan).toHaveBeenCalledWith(
      'api.put..api.custom',
      {
        attributes: {
          'http.method': 'PUT',
          'http.route': '/api/custom',
          component: 'api',
        },
      },
    );
  });
});
