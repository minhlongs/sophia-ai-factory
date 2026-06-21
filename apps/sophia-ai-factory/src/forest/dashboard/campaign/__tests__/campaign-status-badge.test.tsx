import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignStatusBadge } from '../campaign-status-badge';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/seed/components/ui/badge', () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode }) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
}));

describe('CampaignStatusBadge', () => {
  it('renders status label as translation key when no label provided', () => {
    render(<CampaignStatusBadge status="draft" />);
    expect(screen.getByText('draft')).toBeDefined();
  });

  it('renders custom label when provided', () => {
    render(<CampaignStatusBadge status="completed" label="Custom" />);
    expect(screen.getByText('Custom')).toBeDefined();
  });

  it('applies className', () => {
    render(<CampaignStatusBadge status="failed" className="custom-class" />);
    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('custom-class');
  });

  ['draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'].forEach((status) => {
    it(`renders ${status} variant correctly`, () => {
      render(<CampaignStatusBadge status={status as any} />);
      expect(screen.getByText(status)).toBeDefined();
    });
  });
});
