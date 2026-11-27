import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LandingVideoShowcase } from '../modular/landing-video-showcase';

let mockLocale = 'vi';

vi.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/navigation', () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('LandingVideoShowcase', () => {
  beforeEach(() => {
    mockLocale = 'vi';
  });

  it('renders 3 segmented tabs and defaults to the Vietnamese Glean Agents video', () => {
    const { container } = render(<LandingVideoShowcase />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('/videos/sophia-glean-agents-vi.mp4');
    expect(video?.getAttribute('preload')).toBe('metadata');
  });

  it('switches video source when clicking Bolt Skills and Voice Input tabs', () => {
    const { container } = render(<LandingVideoShowcase />);

    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[1]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/videos/sophia-bolt-skills-vi.mp4',
    );

    fireEvent.click(tabs[2]);
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/videos/sophia-voice-input-vi.mp4',
    );
  });

  it('serves English videos when locale is en', () => {
    mockLocale = 'en';
    const { container } = render(<LandingVideoShowcase />);

    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/videos/sophia-glean-agents-en.mp4',
    );
  });
});
