import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import type { UserProfileFormValues } from '@/land/schemas/settings';
import { ZenThemeProvider } from '@/forest/theme/zen-theme-provider';
import { AppearanceSection } from '../appearance-section';
import SettingsPage from '@/components/stitch/screens/settings/settings-page';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'vi',
}));

vi.mock('@/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
  usePathname: () => '/settings',
}));

vi.mock('@/components/settings/settings-jurisdiction-picker', () => ({
  SettingsJurisdictionPicker: () => <div data-testid="stub-jurisdiction" />,
}));

vi.mock('@/components/settings/settings-locale-danger', () => ({
  SettingsLocaleDangerSection: () => <div data-testid="stub-locale-danger" />,
}));

describe('AppearanceSection — cross-route system theme persistence via ZenThemeProvider', () => {
  let prefersDark = false;
  let changeListeners: Array<(event: MediaQueryListEvent) => void> = [];

  beforeEach(() => {
    prefersDark = false;
    changeListeners = [];
    window.localStorage.clear();
    document.documentElement.className = '';

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        get matches() {
          if (query.includes('dark')) return prefersDark;
          if (query.includes('light')) return !prefersDark;
          return false;
        },
        media: query,
        onchange: null,
        addListener: vi.fn((cb: (e: MediaQueryListEvent) => void) => {
          changeListeners.push(cb);
        }),
        removeListener: vi.fn((cb: (e: MediaQueryListEvent) => void) => {
          changeListeners = changeListeners.filter((fn) => fn !== cb);
        }),
        addEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') changeListeners.push(cb);
        }),
        removeEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            changeListeners = changeListeners.filter((fn) => fn !== cb);
          }
        }),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  function buildStubForm(initialTheme: 'light' | 'dark' | 'system') {
    let current = initialTheme;
    const setValue = vi.fn((_name: string, next: 'light' | 'dark' | 'system') => {
      current = next;
    });
    const watch = vi.fn(() => current);
    return {
      form: { watch, setValue } as unknown as UseFormReturn<UserProfileFormValues>,
      setValue,
    };
  }

  it('persists "system" in sophia-zen-theme and keeps syncing OS color-scheme changes even after AppearanceSection unmounts', () => {
    prefersDark = true; // OS starts dark
    const { form } = buildStubForm('system');

    function SettingsHost({ showSettings }: { showSettings: boolean }) {
      return (
        <ZenThemeProvider defaultTheme="dark">
          {showSettings ? <AppearanceSection form={form} /> : <div data-testid="dashboard-route">dashboard</div>}
        </ZenThemeProvider>
      );
    }

    const { rerender } = render(<SettingsHost showSettings={true} />);

    expect(window.localStorage.getItem('sophia-zen-theme')).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Navigate away from /settings (AppearanceSection unmounts, ZenThemeProvider stays mounted)
    rerender(<SettingsHost showSettings={false} />);
    expect(screen.getByTestId('dashboard-route')).toBeDefined();

    // OS switches to Light while on /dashboard — root provider must still react!
    act(() => {
      prefersDark = false;
      for (const cb of [...changeListeners]) {
        cb({ matches: false } as MediaQueryListEvent);
      }
    });

    expect(window.localStorage.getItem('sophia-zen-theme')).toBe('system');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('passes explicit light/dark/system selections directly to next-themes and marks form dirty', () => {
    prefersDark = false; // OS prefers light
    const { form, setValue } = buildStubForm('dark');
    render(
      <ZenThemeProvider defaultTheme="dark">
        <AppearanceSection form={form} />
      </ZenThemeProvider>,
    );

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[2]); // system

    expect(setValue).toHaveBeenCalledWith('settings.theme', 'system', { shouldDirty: true });
    expect(window.localStorage.getItem('sophia-zen-theme')).toBe('system');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('preserves an existing runtime sophia-zen-theme preference on mount instead of clobbering it with form default', () => {
    window.localStorage.setItem('sophia-zen-theme', 'light');
    const { form, setValue } = buildStubForm('dark');

    render(
      <ZenThemeProvider defaultTheme="dark">
        <AppearanceSection form={form} />
      </ZenThemeProvider>,
    );

    expect(window.localStorage.getItem('sophia-zen-theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(setValue).toHaveBeenCalledWith('settings.theme', 'light', { shouldDirty: false });
  });

  it('exposes live 3-mode (light / dark / system) theme selection on the mounted SettingsPage preferences tab', () => {
    prefersDark = false; // OS prefers light
    render(
      <ZenThemeProvider defaultTheme="dark">
        <SettingsPage initialTab="preferences" />
      </ZenThemeProvider>,
    );

    const systemRadio = screen.getByTestId('settings-theme-system');
    fireEvent.click(systemRadio);

    expect(window.localStorage.getItem('sophia-zen-theme')).toBe('system');
    expect(document.documentElement.classList.contains('light')).toBe(true);

    // Live OS toggle to dark updates html class while keeping sophia-zen-theme="system"
    act(() => {
      prefersDark = true;
      for (const cb of [...changeListeners]) {
        cb({ matches: true } as MediaQueryListEvent);
      }
    });
    expect(window.localStorage.getItem('sophia-zen-theme')).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Explicit Light mode selection
    fireEvent.click(screen.getByTestId('settings-theme-light'));
    expect(window.localStorage.getItem('sophia-zen-theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});
