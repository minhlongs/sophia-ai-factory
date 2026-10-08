import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlywheelV13Hud } from '../flywheel-v13-hud';

describe('FlywheelV13Hud Component', () => {
  const mockStats = {
    activeExperiments: 4,
    convergedExperiments: 2,
    deliberationPassRatePct: 87.5,
    totalAttributedRevenueUsd: 12500.5,
    overallShapleyRoas: 4.8,
  };

  it('renders correctly in Vietnamese locale', () => {
    render(<FlywheelV13Hud stats={mockStats} locale="vi" />);
    expect(screen.getByText(/Hệ thống Tối ưu hóa Tăng trưởng \(Growth Triad v13\)/i)).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('87.5%')).toBeDefined();
  });

  it('renders correctly in English locale', () => {
    render(<FlywheelV13Hud stats={mockStats} locale="en" />);
    expect(screen.getByText(/Growth Triad v13 Cockpit/i)).toBeDefined();
    expect(screen.getByText('4.8x')).toBeDefined();
  });

  it('handles refresh button click', async () => {
    const handleRefresh = vi.fn().mockResolvedValue(undefined);
    render(<FlywheelV13Hud stats={mockStats} locale="en" onRefresh={handleRefresh} />);
    const button = screen.getByText('Sync Telemetry');
    fireEvent.click(button);
    expect(handleRefresh).toHaveBeenCalled();
  });
});
