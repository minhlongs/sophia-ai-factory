import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next-intl — StepIndicator uses useTranslations internally
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, opts?: Record<string, unknown>) => {
    if (opts?.fallback) return String(opts.fallback);
    return key;
  },
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString(),
  }),
}));

// Mock useCampaignStream — return stable empty state for unit tests
vi.mock('@/forest/hooks/use-campaign-stream', () => ({
  useCampaignStream: () => ({
    events: [],
    connected: false,
    error: null,
    clearEvents: () => {},
  }),
}));

import { VideoPreview } from './video-preview';

describe('VideoPreview Component', () => {
  const defaultProps = {
    status: 'draft' as const,
    campaignId: 'camp_123'
  };

  it('renders draft state correctly', () => {
    render(<VideoPreview {...defaultProps} />);
    expect(screen.getByText('Video Preview')).toBeDefined();
    expect(screen.getByText('Your AI-generated video is ready.')).toBeDefined();
    expect(screen.getByText('No video available')).toBeDefined();
  });

  it('renders loading state for processing with step indicator', () => {
    render(<VideoPreview {...defaultProps} status="processing_video" progress={45} />);
    // StepIndicator renders pipeline steps for active processing states
    expect(screen.getByText('Scripting')).toBeDefined();
  });

  it('renders loading state for queuing', () => {
    render(<VideoPreview {...defaultProps} status="queued" />);
    // Queued also shows step indicator with pipeline steps
    expect(screen.getByText('Scripting')).toBeDefined();
  });

  it('renders failed state', () => {
    render(<VideoPreview {...defaultProps} status="failed" errorMessage="API Error" />);
    expect(screen.getByText('Generation Failed')).toBeDefined();
    expect(screen.getByText('API Error')).toBeDefined();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeDefined();
  });

  it('renders completed state with video', () => {
    const videoUrl = 'http://test.com/video.mp4';
    const thumbUrl = 'http://test.com/thumb.jpg';

    render(
      <VideoPreview
        {...defaultProps}
        status="completed"
        videoUrl={videoUrl}
        thumbnailUrl={thumbUrl}
      />
    );

    // Initial state shows thumbnail and play button
    const thumb = screen.getByAltText('Video thumbnail');
    // In jsdom test environment, Next.js Image src is passed through without encoding
    const thumbSrc = thumb.getAttribute('src') ?? '';
    expect(thumbSrc === thumbUrl || thumbSrc.includes('thumb.jpg')).toBe(true);

    // Play button should be present
    const playButton = screen.getByRole('button', { name: /play video/i });
    expect(playButton).toBeDefined();

    // Download button should be present as a link
    expect(screen.getByRole('link', { name: /download video/i })).toBeDefined();
  });

  it('switches to video player on play click', () => {
    const videoUrl = 'http://test.com/video.mp4';
    const { container } = render(
      <VideoPreview
        {...defaultProps}
        status="completed"
        videoUrl={videoUrl}
      />
    );

    // Click play
    const playButton = screen.getByRole('button', { name: /play video/i });
    fireEvent.click(playButton);

    // Now video element should be present
    const video = container.querySelector('video');
    expect(video).toBeDefined();
    expect(video?.getAttribute('src')).toBe(videoUrl);
    expect(video?.getAttribute('autoplay')).toBeDefined();
  });
});
