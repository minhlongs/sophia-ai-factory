/**
 * Tests for LocalModeStep component
 *
 * Covers: install one-liner when not provisioned, ineligible state,
 * copy button, polling on mount, health badge color changes.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { LocalModeStep } from './local-mode-step';

// ── Mock fetch ─────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ── Mock navigator ─────────────────────────────────────────────────────────────

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

function clearDeviceMemory() {
  // Remove deviceMemory so eligibility falls back to "sufficient"
  Object.defineProperty(navigator, 'deviceMemory', { value: undefined, configurable: true, writable: true });
}

// ── Mock clipboard ─────────────────────────────────────────────────────────────

const writeTextMock = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: writeTextMock },
  configurable: true,
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function mockStatusResponse(payload: object, status = 200) {
  mockFetch.mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => payload,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  clearDeviceMemory();
  // Default: macOS Apple Silicon UA
  setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 AppleWebkit/605.1.15 Apple');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LocalModeStep', () => {
  it('shows install one-liner when user is eligible and not provisioned', async () => {
    mockStatusResponse({ provisioned: false, endpoint_hostname: null, last_health_at: null, status: 'unknown' });

    await act(async () => {
      render(<LocalModeStep />);
      // Let useEffect + fetch resolve
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/curl -fsSL/i)).toBeDefined();
    expect(screen.getByLabelText(/sao chép/i)).toBeDefined();
  });

  it('shows ineligible state on non-darwin userAgent', async () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    // fetch should NOT be called for ineligible (no status check needed)
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    await act(async () => {
      render(<LocalModeStep />);
      await vi.runAllTimersAsync();
    });

    // Badge and info-box both contain the phrase — assert at least one exists
    const matches = screen.getAllByText(/không tương thích/i);
    expect(matches.length).toBeGreaterThan(0);
    // Install command must NOT appear
    expect(screen.queryByText(/curl -fsSL/i)).toBeNull();
  });

  it('copy button calls navigator.clipboard.writeText with install command', async () => {
    mockStatusResponse({ provisioned: false, endpoint_hostname: null, last_health_at: null, status: 'unknown' });

    await act(async () => {
      render(<LocalModeStep />);
      await vi.runAllTimersAsync();
    });

    const copyBtn = screen.getByLabelText(/sao chép/i);
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('curl -fsSL https://sophia.agencyos.network/install/local-mode'),
    );
  });

  it('starts polling GET /api/setup/local-mode/status after clicking "I ran it"', async () => {
    mockStatusResponse({ provisioned: false, endpoint_hostname: null, last_health_at: null, status: 'unknown' });

    await act(async () => {
      render(<LocalModeStep />);
      await vi.runAllTimersAsync();
    });

    // Should have called fetch once for initial status
    expect(mockFetch).toHaveBeenCalledWith('/api/setup/local-mode/status');
    const callCountBefore = mockFetch.mock.calls.length;

    // Click start-polling button
    const startBtn = screen.getByText(/tôi đã chạy lệnh/i);
    await act(async () => {
      fireEvent.click(startBtn);
      // Advance timer by 5s (one poll interval)
      await vi.advanceTimersByTimeAsync(5_000);
    });

    // Fetch should have been called again for the poll
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callCountBefore);
    // All calls should be to the status endpoint
    const statusCalls = mockFetch.mock.calls.filter(
      (c: unknown[]) => c[0] === '/api/setup/local-mode/status',
    );
    expect(statusCalls.length).toBeGreaterThan(0);
  });

  it('renders green health badge when status is provisioned-healthy', async () => {
    mockStatusResponse({
      provisioned: true,
      endpoint_hostname: 'localhost',
      last_health_at: new Date().toISOString(),
      status: 'healthy',
    });

    await act(async () => {
      render(<LocalModeStep />);
      // Flush the initial fetch Promise and state update
      await vi.runAllTimersAsync();
    });

    // After all timers + microtasks, badge should reflect healthy state
    const badge = screen.getByRole('status');
    expect(badge.className).toContain('green');
  });

  it('renders red health badge when status is provisioned-failed', async () => {
    mockStatusResponse({
      provisioned: true,
      endpoint_hostname: 'localhost',
      last_health_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'failed',
    });

    await act(async () => {
      render(<LocalModeStep />);
      await vi.runAllTimersAsync();
    });

    const badge = screen.getByRole('status');
    expect(badge.className).toContain('red');
  });
});
