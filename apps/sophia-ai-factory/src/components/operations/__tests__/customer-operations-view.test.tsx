import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerOperationsView } from '../customer-operations-view';
import * as diagnosticBundle from '@/components/support/diagnostic-bundle-generator';

describe('CustomerOperationsView', () => {
  const sampleBatchQueue = {
    runningCount: 2,
    scheduledCount: 5,
    completedCount: 18,
    failedCount: 1,
    recentJobs: [
      { id: 'job-1', title: 'Top 5 AI Tools in 2026', status: 'running' as const, createdAt: new Date().toISOString() },
      { id: 'job-2', title: 'Viral Shorts Finance', status: 'completed' as const, createdAt: new Date().toISOString() },
    ],
  };

  const sampleSyndication = {
    youtube: { status: 'connected' as const, channelTitle: 'Sophia AI Empire', activeVideosCount: 18 },
    tiktok: { status: 'connected' as const, accountName: '@sophia_trends', activeVideosCount: 12 },
    telegram: { status: 'connected' as const, alertsEnabled: true },
  };

  it('renders batch queue metrics and syndication channels in Vietnamese', () => {
    render(
      <CustomerOperationsView
        locale="vi"
        userId="usr_test_123"
        batchQueue={sampleBatchQueue}
        syndication={sampleSyndication}
        openTicketsCount={2}
      />
    );

    expect(screen.getByText('Trung tâm Vận hành')).toBeDefined();
    expect(screen.getByText('Hàng đợi Render Video (Batch Queue)')).toBeDefined();
    expect(screen.getByText('Đang render')).toBeDefined();
    expect(screen.getByText('Top 5 AI Tools in 2026')).toBeDefined();
    expect(screen.getByText('YouTube')).toBeDefined();
    expect(screen.getByText('Sophia AI Empire')).toBeDefined();
    expect(screen.getByText('TikTok')).toBeDefined();
    expect(screen.getByText('Telegram Bot')).toBeDefined();
  });

  it('renders operations center in English', () => {
    render(
      <CustomerOperationsView
        locale="en"
        userId="usr_test_123"
        batchQueue={sampleBatchQueue}
        syndication={sampleSyndication}
        openTicketsCount={0}
      />
    );

    expect(screen.getByText('Customer Operations Center')).toBeDefined();
    expect(screen.getByText('Batch Queue Monitoring')).toBeDefined();
    expect(screen.getAllByText('Running').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Scheduled')).toBeDefined();
  });

  it('triggers diagnostic download when button is clicked', () => {
    const downloadSpy = vi.spyOn(diagnosticBundle, 'downloadDiagnosticBundle').mockImplementation(() => {});

    render(
      <CustomerOperationsView
        locale="vi"
        userId="usr_test_123"
        batchQueue={sampleBatchQueue}
        syndication={sampleSyndication}
        openTicketsCount={0}
      />
    );

    const downloadBtn = screen.getByRole('button', { name: /Tải Báo cáo Chẩn đoán/i });
    fireEvent.click(downloadBtn);

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    downloadSpy.mockRestore();
  });

  it('renders empty queue state when recent jobs list is empty', () => {
    render(
      <CustomerOperationsView
        locale="vi"
        userId="usr_test_123"
        batchQueue={{ runningCount: 0, scheduledCount: 0, completedCount: 0, failedCount: 0, recentJobs: [] }}
        syndication={sampleSyndication}
        openTicketsCount={0}
      />
    );

    expect(screen.getByText('Chưa có tác vụ video nào trong hàng đợi.')).toBeDefined();
  });
});
