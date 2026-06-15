/**
 * Tests for HelpTooltip component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpTooltip, type HelpTooltipContent } from './help-tooltip';

// Module-level locale state — mock factory reads this at CALL time (not factory time)
let currentLocale = 'en';

function makeMock(locale: string) {
  const isVi = locale.startsWith('vi');
  const en: Record<string, string | ((v?: string) => string)> = {
    aria_trigger: (v?: string) => v ? `Help for ${v}` : 'Help',
    close: 'Close', dialog_label: 'Help dialog', header: 'Help',
    tutorial_video: 'Tutorial video', video_coming_soon: 'Video coming soon',
    watch_video: 'Watch video', help_center: 'Help center',
  };
  const vi: Record<string, string | ((v?: string) => string)> = {
    aria_trigger: (v?: string) => v ? `Trợ giúp cho ${v}` : 'Trợ giúp',
    close: 'Đóng', dialog_label: 'Hộp thoại trợ giúp', header: 'Trợ giúp',
    tutorial_video: 'Video hướng dẫn', video_coming_soon: 'Video sắp ra mắt',
    watch_video: 'Xem video', help_center: 'Trung tâm trợ giúp',
  };
  const dict = isVi ? vi : en;
  return (key: string, values?: Record<string, string>) => {
    const fn = dict[key];
    return typeof fn === 'function' ? (fn as (v?: string) => string)(values?.label) : (fn ?? key);
  };
}

// Hoisted mock: factory runs at module load, but RETURNED function reads currentLocale at CALL time
vi.mock('next-intl', () => ({
  useTranslations: () => {
    const locale = currentLocale;
    return (key: string, values?: Record<string, string>) => makeMock(locale)(key, values);
  },
}));

const CONTENT_EN: HelpTooltipContent = {
  introEn: 'English intro text here.', introVi: 'Vietnamese intro text here.',
  videoSlug: 'welcome', videoPublished: false,
  videoTitleEn: 'Welcome video', videoTitleVi: 'Video chào mừng',
};
const CONTENT_PUBLISHED: HelpTooltipContent = {
  introEn: 'This video is live.', introVi: 'Video này đang trực tiếp.',
  videoSlug: 'setup-byok-keys', videoPublished: true,
  videoTitleEn: 'Setup BYOK Keys', videoTitleVi: 'Cấu hình khóa BYOK',
};

describe('HelpTooltip', () => {
  beforeEach(() => { currentLocale = 'en'; });

  it('renders the trigger button', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} />);
    expect(screen.getByRole('button', { name: /Help for/i })).toBeTruthy();
  });

  it('opens modal on trigger click', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} />);
    fireEvent.click(screen.getByRole('button', { name: /Help for/i }));
    expect(screen.getByText('English intro text here.')).toBeTruthy();
  });

  it('shows Vietnamese intro when locale=vi', () => {
    currentLocale = 'vi';
    render(<HelpTooltip locale="vi" content={CONTENT_EN} />);
    fireEvent.click(screen.getByRole('button', { name: /Trợ giúp/i }));
    expect(screen.getByText('Vietnamese intro text here.')).toBeTruthy();
  });

  it('shows coming soon for unpublished video', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} />);
    fireEvent.click(screen.getByRole('button', { name: /Help for/i }));
    expect(screen.getByText('Video coming soon')).toBeTruthy();
  });

  it('shows watch link for published video', () => {
    render(<HelpTooltip locale="en" content={CONTENT_PUBLISHED} />);
    fireEvent.click(screen.getByRole('button', { name: /Help for/i }));
    expect(screen.getByText('Watch video')).toBeTruthy();
  });

  it('shows Vietnamese watch label when locale=vi', () => {
    currentLocale = 'vi';
    render(<HelpTooltip locale="vi" content={CONTENT_PUBLISHED} />);
    fireEvent.click(screen.getByRole('button', { name: /Trợ giúp/i }));
    expect(screen.getByText('Xem video')).toBeTruthy();
  });

  it('closes modal on close button click', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} />);
    fireEvent.click(screen.getByRole('button', { name: /Help for/i }));
    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes modal on Escape key', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} />);
    fireEvent.click(screen.getByRole('button', { name: /Help for/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders without video section when no videoSlug', () => {
    const noVideo: HelpTooltipContent = { introEn: 'No video here.', introVi: 'Không có video.' };
    render(<HelpTooltip locale="en" content={noVideo} />);
    fireEvent.click(screen.getByRole('button', { name: /Help for/i }));
    expect(screen.queryByText('Tutorial video')).toBeNull();
  });

  it('uses custom pageLabel in aria-label', () => {
    render(<HelpTooltip locale="en" content={CONTENT_EN} pageLabel="My Page" />);
    expect(screen.getByRole('button', { name: /Help for My Page/i })).toBeTruthy();
  });
});
