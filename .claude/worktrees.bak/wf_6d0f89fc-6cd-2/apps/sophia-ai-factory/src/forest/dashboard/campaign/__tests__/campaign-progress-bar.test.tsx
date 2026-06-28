import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignProgressBar } from '../campaign-progress-bar';

describe('CampaignProgressBar', () => {
  it('renders with correct progress width', () => {
    render(<CampaignProgressBar progress={50} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(bar.style.width).toBe('50%');
  });

  it('clamps progress to 0-100 range', () => {
    const { rerender } = render(<CampaignProgressBar progress={-10} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.style.width).toBe('0%');

    rerender(<CampaignProgressBar progress={150} />);
    expect(bar.style.width).toBe('100%');
  });

  it('applies custom className', () => {
    render(<CampaignProgressBar progress={30} className="custom" />);
    const container = screen.getByRole('progressbar').parentElement;
    expect(container?.className).toContain('custom');
  });

  it('sets accessibility attributes', () => {
    render(<CampaignProgressBar progress={75} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });
});
