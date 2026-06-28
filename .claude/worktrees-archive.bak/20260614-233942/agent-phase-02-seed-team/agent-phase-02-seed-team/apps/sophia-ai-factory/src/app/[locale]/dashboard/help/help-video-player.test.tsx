/**
 * Tests for HelpVideoPlayer component.
 * Verifies unpublished placeholder, published video element, close behavior.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpVideoPlayer } from './help-video-player';
import type { HelpVideo } from '@/forest/help/help-video-store';

const BASE_VIDEO: HelpVideo = {
  id: 'hv_01',
  slug: 'welcome',
  title_en: 'Welcome to Sophia',
  title_vi: 'Chào mừng',
  description_en: 'Platform overview.',
  description_vi: 'Tổng quan nền tảng.',
  r2_key: null,
  duration_sec: 90,
  category: 'getting-started',
  order_index: 1,
  published: 0,
  created_at: 1700000000,
};

describe('HelpVideoPlayer', () => {
  it('shows coming-soon placeholder for unpublished video', () => {
    const onClose = vi.fn();
    render(<HelpVideoPlayer video={BASE_VIDEO} locale="en" onClose={onClose} />);
    expect(screen.getByText('Video coming soon')).toBeTruthy();
  });

  it('shows Vietnamese placeholder text for locale=vi', () => {
    const onClose = vi.fn();
    render(<HelpVideoPlayer video={BASE_VIDEO} locale="vi" onClose={onClose} />);
    expect(screen.getByText('Video sắp ra mắt')).toBeTruthy();
  });

  it('renders video element for published video with r2_key', () => {
    const publishedVideo: HelpVideo = { ...BASE_VIDEO, published: 1, r2_key: 'help/welcome.mp4' };
    const onClose = vi.fn();
    render(<HelpVideoPlayer video={publishedVideo} locale="en" onClose={onClose} />);
    const videoEl = document.querySelector('video');
    expect(videoEl).toBeTruthy();
    expect(videoEl?.getAttribute('src')).toContain('welcome.mp4');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<HelpVideoPlayer video={BASE_VIDEO} locale="en" onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<HelpVideoPlayer video={BASE_VIDEO} locale="en" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders dialog with correct title', () => {
    const onClose = vi.fn();
    render(<HelpVideoPlayer video={BASE_VIDEO} locale="en" onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Welcome to Sophia');
  });

  it('shows Vietnamese title when locale=vi', () => {
    const onClose = vi.fn();
    render(<HelpVideoPlayer video={BASE_VIDEO} locale="vi" onClose={onClose} />);
    expect(screen.getByText('Chào mừng')).toBeTruthy();
  });
});
