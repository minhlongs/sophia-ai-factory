import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { UnifiedGrowthCockpit } from '../unified-growth-cockpit';
import { PredictiveRenderJob } from '@/seed/types/growth-triad-v14';

describe('Presentation: Unified Growth Cockpit', () => {
  const sampleJobs: PredictiveRenderJob[] = [
    {
      id: 'job-1',
      userId: 'usr-1',
      scriptId: 'script-one',
      deliberationScore: 85,
      kellyAllocationFraction: 0.2,
      allocatedMcu: 200,
      actualMcuConsumed: 200,
      status: 'COMPLETED',
      createdAt: 1000,
      updatedAt: 2000,
    },
    {
      id: 'job-2',
      userId: 'usr-1',
      scriptId: 'script-two',
      deliberationScore: 75,
      kellyAllocationFraction: 0.1,
      allocatedMcu: 100,
      actualMcuConsumed: 35,
      status: 'HALTED_EARLY',
      earlyHaltProbability: 0.15,
      haltReason: 'Preserving GPU resources',
      createdAt: 1100,
      updatedAt: 2100,
    },
  ];

  it('renders aggregate metrics and jobs from fetcher', async () => {
    const mockFetcher = vi.fn().mockResolvedValue(sampleJobs);

    render(<UnifiedGrowthCockpit fetcher={mockFetcher} locale="vi" />);

    await waitFor(() => {
      expect(screen.getByText('300 MCU')).toBeDefined(); // Total allocated MCU
      expect(screen.getByText('script-one')).toBeDefined();
      expect(screen.getByText('script-two')).toBeDefined();
    });
  });

  it('renders empty placeholder when no jobs exist', async () => {
    const mockFetcher = vi.fn().mockResolvedValue([]);

    render(<UnifiedGrowthCockpit fetcher={mockFetcher} locale="vi" />);

    await waitFor(() => {
      expect(screen.getByText(/Chưa có tác vụ render nào được phân bổ/i)).toBeDefined();
    });
  });
});
