/**
 * Tests for HelpTooltip component.
 * Verifies bilingual render, modal open/close, video states.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { HelpTooltip, type HelpTooltipContent } from './help-tooltip';

const messages: Record<string, Record<string, string>> = {};

const CONTENT_EN: HelpTooltipContent = {
  introEn: 'English intro text here.',
  introVi: 'Vietnamese intro text here.',
  videoSlug: 'welcome',
  videoPublished: false,
  videoTitleEn: 'Welcome video',
  videoTitleVi: 'Video chào mừng',
};

const CONTENT_PUBLISHED: HelpTooltipContent = {
  introEn: 'This video is live.',
  introVi: 'Video này đang trực tiếp.',
  videoSlug: 'setup-byok-keys',
  videoPublished: true,
  videoTitleEn: 'Setup BYOK Keys',
  videoTitleVi: 'Cấu hình khóa BYOK',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NextIntlClientProvider locale="en" messages={messages}>{children}</NextIntlClientProvider>
);

describe('HelpTooltip', () => {
  it('renders the trigger "?" button', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} />, { wrapper });
    const btn = screen.getByRole('button', { name: /help for/i });
    expect(btn).toBeTruthy();
  });

  it('opens modal on trigger click', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} />, { wrapper });
    const btn = screen.getByRole('button', { name: /help for/i });
    fireEvent.click(btn);
    expect(screen.getByText('English intro text here.')).toBeTruthy();
  });

  it('shows Vietnamese intro when locale=vi', () => {
    render(<HelpTooltip locale="vi" content={CONTENT_EN} />, { wrapper });
    const btn = screen.getByRole('button', { name: /Trợ giúp/i });
    fireEvent.click(btn);
    expect(screen.getByText('Vietnamese intro text here.')).toBeTruthy();
  });

  it('shows "coming soon" for unpublished video', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /help for/i }));
    expect(screen.getByText('Video coming soon')).toBeTruthy();
  });

  it('shows watch link for published video', () => {
    render(<HelpTooltip locale="en" content={CONTENT_PUBLISHED} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /help for/i }));
    expect(screen.getByText('Watch video')).toBeTruthy();
  });

  it('shows Vietnamese watch label when published + locale=vi', () => {
    render(<HelpTooltip locale="vi" content={CONTENT_PUBLISHED} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /Trợ giúp/i }));
    expect(screen.getByText('Xem video')).toBeTruthy();
  });

  it('closes modal on close button click', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /help for/i }));
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes modal on Escape key', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /help for/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders empty-state tooltip without video section when no videoSlug', () => {
    const noVideo: HelpTooltipContent = { introEn: 'No video here.', introVi: 'Không có video.' };
    render(<HelpTooltip locale="en" content={noVideo} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /help for/i }));
    expect(screen.queryByText('Tutorial video')).toBeNull();
  });

  it('uses custom pageLabel in aria-label', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} pageLabel="My Page" />, { wrapper });
    const btn = screen.getByRole('button', { name: /Help for My Page/i });
    expect(btn).toBeTruthy();
  });
});
