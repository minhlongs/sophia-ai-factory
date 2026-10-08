import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ArbitrageCard, type ArbitrageMetricsData } from '../arbitrage-card';

describe('ArbitrageCard Component', () => {
  it('renders default wireframe values in English when no data is provided', () => {
    render(<ArbitrageCard locale="en" />);

    // Header & badge
    expect(screen.getByText('Growth Triad v11')).toBeDefined();
    expect(screen.getByText('Live Optimization')).toBeDefined();
    expect(screen.getByText('Cross-Platform Virality & Compute Arbitrage')).toBeDefined();

    // KPI values
    expect(screen.getByText('+34.8%')).toBeDefined();
    expect(screen.getByText('$418.50')).toBeDefined();
    expect(screen.getByText('0.142 JSD')).toBeDefined();
    expect(screen.getByText('99.8%')).toBeDefined();

    // Table rows
    expect(screen.getByText('TikTok')).toBeDefined();
    expect(screen.getByText('YouTube Shorts')).toBeDefined();
    expect(screen.getByText('Instagram Reels')).toBeDefined();

    // Calculated Scores
    expect(screen.getByText('0.884')).toBeDefined();
    expect(screen.getByText('0.912')).toBeDefined();
    expect(screen.getByText('0.765')).toBeDefined();

    // Compute Engine HUD
    expect(screen.getByText('OFF-PEAK QUEUE')).toBeDefined();
    expect(screen.getByText('18 dispatched')).toBeDefined();
    expect(screen.getByText('42 degraded/fast')).toBeDefined();
    expect(screen.getByText('ALL CLOSED (HEALTHY)')).toBeDefined();
  });

  it('renders bilingual Vietnamese text when locale="vi"', () => {
    render(<ArbitrageCard locale="vi" />);

    expect(screen.getByText('Tối ưu hóa Trực tiếp')).toBeDefined();
    expect(screen.getByText('Chênh lệch Lan truyền & Chi phí Tính toán Đa nền tảng')).toBeDefined();
    expect(screen.getByText('Hiệu chỉnh lại Tất cả')).toBeDefined();
    expect(screen.getByText('Thực thi Arbitrage')).toBeDefined();
    expect(screen.getByText('Tăng trưởng Tiếp cận Phối hợp')).toBeDefined();
    expect(screen.getByText('Chi phí Tính toán Tiết kiệm')).toBeDefined();
    expect(screen.getByText('Độ lệch Hook Đang hoạt động')).toBeDefined();
    expect(screen.getByText('Tránh Shadowban')).toBeDefined();
    expect(screen.getByText('HÀNG ĐỢI NGOÀI GIỜ')).toBeDefined();
    expect(screen.getByText('TẤT CẢ ĐÓNG (KHỎE MẠNH)')).toBeDefined();
  });

  it('renders custom data values accurately', () => {
    const customData: ArbitrageMetricsData = {
      reachLiftPercentage: 45.2,
      reachLiftComparison: '↑ 20.0% lift',
      computeSavingsUsd: 520.75,
      computeSavingsNote: 'Custom savings note',
      activeHookDivergenceJsd: 0.185,
      divergenceNote: 'Optimal band',
      shadowbanAvoidanceRate: 100.0,
      shadowbanNote: 'Clear',
      platformMatrix: [
        {
          platform: 'TIKTOK',
          name: 'TikTok Pro',
          governingMetric: 'Rewatch Metric',
          calculatedScore: 0.955,
          hookMutation: 'Special Hook Variation',
          status: 'OPTIMIZED',
        },
      ],
      computeHud: {
        regime: 'REALTIME PHOTOREAL',
        regimeDescription: 'Instant generation dispatched',
        heygenDispatched: 25,
        heygenCapacityPercent: 90,
        didDispatched: 10,
        didCapacityPercent: 20,
        circuitBreakerStatus: 'NORMAL',
      },
    };

    render(<ArbitrageCard data={customData} locale="en" />);

    expect(screen.getByText('+45.2%')).toBeDefined();
    expect(screen.getByText('$520.75')).toBeDefined();
    expect(screen.getByText('0.185 JSD')).toBeDefined();
    expect(screen.getByText('100.0%')).toBeDefined();
    expect(screen.getByText('TikTok Pro')).toBeDefined();
    expect(screen.getByText('0.955')).toBeDefined();
    expect(screen.getByText('Special Hook Variation')).toBeDefined();
    expect(screen.getByText('REALTIME PHOTOREAL')).toBeDefined();
    expect(screen.getByText('25 dispatched')).toBeDefined();
    expect(screen.getByText('10 degraded/fast')).toBeDefined();
  });

  it('triggers onRecalibrate and onExecute callback handlers', async () => {
    const handleRecalibrate = vi.fn().mockResolvedValue(undefined);
    const handleExecute = vi.fn().mockResolvedValue(undefined);

    render(
      <ArbitrageCard
        locale="en"
        onRecalibrate={handleRecalibrate}
        onExecute={handleExecute}
      />
    );

    const recalibrateBtn = screen.getByText('Recalibrate All');
    const executeBtn = screen.getByText('Execute Arbitrage');

    fireEvent.click(recalibrateBtn);
    expect(handleRecalibrate).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText('Action completed successfully')).toBeDefined();
    });

    fireEvent.click(executeBtn);
    expect(handleExecute).toHaveBeenCalledTimes(1);
  });

  it('renders accessibility progressbars for HeyGen and D-ID', () => {
    render(<ArbitrageCard locale="en" />);

    const progressbars = screen.getAllByRole('progressbar');
    expect(progressbars.length).toBe(2);
    expect(progressbars[0].getAttribute('aria-valuenow')).toBe('75');
    expect(progressbars[1].getAttribute('aria-valuenow')).toBe('45');
  });
});
