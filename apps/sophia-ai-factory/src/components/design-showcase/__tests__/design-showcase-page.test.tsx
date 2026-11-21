import * as React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../../messages/en.json';
import viMessages from '../../../../messages/vi.json';
import { DesignShowcasePage } from '../design-showcase-page';

const setThemeMock = vi.fn();
let mockedTheme: 'dark' | 'light' = 'dark';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: mockedTheme,
    resolvedTheme: mockedTheme,
    setTheme: setThemeMock,
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderShowcase(locale: 'en' | 'vi' = 'en') {
  const messages = locale === 'vi' ? viMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DesignShowcasePage />
    </NextIntlClientProvider>,
  );
}

describe('DesignShowcasePage', () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);
  const createObjectURLMock = vi.fn().mockReturnValue('blob:zen-dtcg-test');
  const revokeObjectURLMock = vi.fn();

  beforeEach(() => {
    mockedTheme = 'dark';
    setThemeMock.mockReset();
    writeTextMock.mockClear();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURLMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all Zen Design OS sections in English with passing WCAG summary', () => {
    renderShowcase('en');

    expect(screen.getByRole('heading', { level: 1, name: 'Zen Design OS v1.0' })).toBeTruthy();
    expect(screen.getByTestId('active-theme-badge').textContent).toContain('Dark');
    expect(screen.getByTestId('wcag-pass-summary').textContent).toContain('12/12');

    const studioStage = screen.getByTestId('studio-stage-invariant');
    expect(studioStage.style.backgroundColor).toBe('var(--studio-stage-bg)');
    expect(studioStage.style.color).toBe('var(--studio-stage-fg)');
  });

  it('renders Vietnamese translations cleanly and links to alternate locale', () => {
    renderShowcase('vi');

    expect(screen.getByText('Sân chơi Component Tương tác')).toBeTruthy();
    expect(screen.getByText('Sân khấu Tối Studio Bất biến')).toBeTruthy();

    const localeLink = screen.getByRole('link', { name: 'Chuyển ngôn ngữ' });
    expect(localeLink.getAttribute('href')).toBe('/en/design');
  });

  it('toggles theme via ThemeToggle', () => {
    renderShowcase('en');
    const toggle = screen.getByTestId('theme-toggle');
    fireEvent.click(toggle);
    expect(setThemeMock).toHaveBeenCalledWith('light');
  });

  it('updates live UI primitives in the interactive component playground', () => {
    renderShowcase('en');

    const buttonPreview = screen.getByTestId('playground-button-preview');
    expect(buttonPreview.getAttribute('data-variant')).toBe('primary');
    expect(buttonPreview.hasAttribute('disabled')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'glow' }));
    expect(buttonPreview.getAttribute('data-variant')).toBe('glow');

    fireEvent.click(screen.getByTestId('playground-button-disabled-toggle'));
    expect(buttonPreview.hasAttribute('disabled')).toBe(true);

    const inputPreview = screen.getByTestId('playground-input-preview') as HTMLInputElement;
    fireEvent.change(inputPreview, { target: { value: 'zen-pipeline' } });
    expect(inputPreview.value).toBe('zen-pipeline');
  });

  it('filters DTCG tokens via search and shows empty state when unmatched', () => {
    renderShowcase('en');

    const searchInput = screen.getByTestId('dtcg-search-input');
    const initialCountText = screen.getByTestId('dtcg-match-count').textContent ?? '';

    fireEvent.change(searchInput, { target: { value: 'motion.duration.fast' } });
    expect(screen.getByText('motion.duration.fast')).toBeTruthy();
    expect(screen.getByTestId('dtcg-match-count').textContent).not.toBe(initialCountText);

    fireEvent.change(searchInput, { target: { value: 'nonexistent-token-xyz-999' } });
    expect(screen.getByTestId('dtcg-empty-state')).toBeTruthy();
  });

  it('copies CSS vars, copies DTCG JSON, and downloads DTCG JSON file', async () => {
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    renderShowcase('en');

    fireEvent.click(screen.getByTestId('copy-css-vars-button'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('--primary:'));
    });

    fireEvent.click(screen.getByTestId('copy-dtcg-json-button'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('"ZEN DESIGN OS"'));
    });

    fireEvent.click(screen.getByTestId('download-dtcg-json-button'));
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('design-status-live').textContent).toContain(
      'zen-design-tokens.dtcg.json',
    );
  });

  it('announces fallback message when clipboard write fails and supports inspect mode switching', async () => {
    writeTextMock.mockRejectedValueOnce(new Error('Clipboard denied'));

    renderShowcase('en');

    const archivoSpecimen = screen.getByTestId('archivo-specimen');
    expect(archivoSpecimen.style.fontFamily).toBe('var(--font-display)');

    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByTestId('copy-css-vars-button'));
    await waitFor(() => {
      expect(screen.getByTestId('design-status-live').textContent).toContain('unavailable');
    });
  });
});
