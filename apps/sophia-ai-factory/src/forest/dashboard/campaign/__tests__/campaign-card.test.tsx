import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CampaignCard } from '../campaign-card';
import type { Campaign } from '@/seed/types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({
    dateTime: (date: Date) => date.toLocaleDateString(),
  }),
}));

vi.mock('@/seed/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode; onClick?: () => void }) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/seed/components/ui/badge', () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode }) => (
    <span data-testid="badge" {...props}>{children}</span>
  ),
}));

vi.mock('@/seed/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="button" {...props}>{children}</button>
  ),
}));

vi.mock('lucide-react', () => ({
  CheckCircle2: () => <div data-testid="icon-check" />,
  AlertCircle: () => <div data-testid="icon-alert" />,
  Clock: () => <div data-testid="icon-clock" />,
  FileText: () => <div data-testid="icon-file" />,
  Loader2: () => <div data-testid="icon-loader" />,
  PlayCircle: () => <div data-testid="icon-play" />,
}));

const mockCampaign: Campaign = {
  id: '1',
  user_id: 'user1',
  title: 'Test Campaign',
  topic: null,
  audience: 'General audience',
  status: 'draft',
  progress: 0,
  error_message: null,
  script_content: null,
  audio_url: null,
  video_url: null,
  thumbnail_url: null,
  template_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('CampaignCard', () => {
  it('renders campaign title', () => {
    render(<CampaignCard campaign={mockCampaign} onSelect={() => {}} />);
    expect(screen.getByText('Test Campaign')).toBeDefined();
  });

  it('renders audience when provided', () => {
    render(<CampaignCard campaign={mockCampaign} onSelect={() => {}} />);
    expect(screen.getByText('General audience')).toBeDefined();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<CampaignCard campaign={mockCampaign} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('card'));
    expect(onSelect).toHaveBeenCalledWith(mockCampaign);
  });

  it('shows progress bar for processing status', () => {
    const processingCampaign: Campaign = { ...mockCampaign, status: 'processing_script', progress: 45 };
    render(<CampaignCard campaign={processingCampaign} onSelect={() => {}} />);
    expect(screen.getByText('45%')).toBeDefined();
    expect(screen.getByRole('progressbar')).toBeDefined();
  });

  it('displays error message when present', () => {
    const errorCampaign: Campaign = { ...mockCampaign, status: 'failed', error_message: 'Something broke' };
    render(<CampaignCard campaign={errorCampaign} onSelect={() => {}} />);
    expect(screen.getByText('Something broke')).toBeDefined();
  });

  it('shows watch video link when video_url exists', () => {
    const completedCampaign: Campaign = { ...mockCampaign, status: 'completed', video_url: 'https://example.com/video' };
    render(<CampaignCard campaign={completedCampaign} onSelect={() => {}} />);
    expect(screen.getByText('watch_video')).toBeDefined();
  });
});
