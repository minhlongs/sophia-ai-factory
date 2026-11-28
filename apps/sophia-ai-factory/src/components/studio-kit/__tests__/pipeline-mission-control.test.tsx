import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SOPHIA_STUDIO_CAPABILITIES } from '@/seed/ui/studio-capability-registry';
import { groupCapabilitiesIntoStages } from '@/seed/ui/pipeline-stage-manifest';
import {
  DEFAULT_LIVE_PIPELINE_INPUT,
  runAll34EnginesSnapshot,
} from '@/seed/ui/live-pipeline-runner';
import { StudioCommandPalette } from '../studio-command-palette';

vi.mock('@/navigation', () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('39-Engine Live Mission Control (MD3 Expressive)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('groups all 39 registered engines into 5 stages [8, 7, 8, 9, 7] with zero duplicates', () => {
    const stages = groupCapabilitiesIntoStages(SOPHIA_STUDIO_CAPABILITIES);
    expect(stages.map((s) => s.capabilities.length)).toEqual([8, 7, 8, 9, 7]);
    const uniqueIds = new Set(stages.flatMap((s) => s.capabilities.map((c) => c.id)));
    expect(uniqueIds.size).toBe(39);
  });

  it('runs all 39 engines via POST /api/studio/pipeline/execute, shows LIVE D1 receipt & live inspector telemetry', async () => {
    const snapshot = runAll34EnginesSnapshot(DEFAULT_LIVE_PIPELINE_INPUT);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        executedAt: '2026-11-28T07:00:00.000Z',
        telemetrySource: 'live_d1',
        totalEngines: snapshot.length,
        results: snapshot,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<StudioCommandPalette locale="en" />);
    expect(screen.getByTestId('opc-commander-roe-bar')).toBeDefined();
    fireEvent.click(screen.getByTestId('run-39-engines-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('pipeline-verified-receipt-card')).toBeDefined();
    });
    const sentBody = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body ?? '{}')) as Record<string, unknown>;
    expect(sentBody.grossUsd).toBeUndefined();
    expect(screen.getByTestId('receipt-telemetry-source').textContent).toContain('LIVE D1 DATA');

    fireEvent.click(screen.getByTestId('engine-pill-subid-watermark-encoder'));
    expect(screen.getByText('Live Output')).toBeDefined();
  });

  it('surfaces inline role="alert" on server HTTP 400 failure without faking a LIVE D1 receipt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, error: 'Invalid pipeline input payload' }),
      }),
    );

    render(<StudioCommandPalette locale="en" />);
    fireEvent.click(screen.getByTestId('run-39-engines-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Invalid pipeline input payload');
    });
    expect(screen.queryByTestId('pipeline-verified-receipt-card')).toBeNull();
  });
});
