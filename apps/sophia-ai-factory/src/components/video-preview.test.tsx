import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders loading state for processing', () => {
    render(<VideoPreview {...defaultProps} status="processing_video" progress={45} />);
    expect(screen.getByText(/Generating your video... 45%/)).toBeDefined();
    expect(screen.getByText('Rendering video avatar...')).toBeDefined();
  });

  it('renders loading state for queuing', () => {
    render(<VideoPreview {...defaultProps} status="queued" />);
    expect(screen.getByText('Queued for generation...')).toBeDefined();
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
    expect(thumb.getAttribute('src')).toBe(thumbUrl);

    // Play button should be present
    // Note: Lucide icons might not have accessible names by default unless aria-label is added to Button
    // Looking at component code: Button has just Icon.
    // Let's find button by role 'button' inside the container
    const playButton = screen.getAllByRole('button')[0];
    expect(playButton).toBeDefined();

    // Download button should be present
    expect(screen.getByText('Download Video')).toBeDefined();
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
    // The button is inside the overlay
    const playButton = screen.getAllByRole('button')[0];
    fireEvent.click(playButton);

    // Now video element should be present
    const video = container.querySelector('video');
    expect(video).toBeDefined();
    expect(video?.getAttribute('src')).toBe(videoUrl);
    expect(video?.getAttribute('autoplay')).toBeDefined();
  });
});
