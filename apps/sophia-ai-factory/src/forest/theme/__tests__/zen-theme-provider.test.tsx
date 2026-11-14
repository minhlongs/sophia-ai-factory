import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useTheme } from 'next-themes';
import { ZenThemeProvider } from '../zen-theme-provider';

let osPrefersDark = false;
let mediaListeners: Array<(event: MediaQueryListEvent) => void> = [];

function installMatchMediaStub(initialPrefersDark = false) {
  osPrefersDark = initialPrefersDark;
  mediaListeners = [];
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      get matches() {
        if (query.includes('dark')) return osPrefersDark;
        if (query.includes('light')) return !osPrefersDark;
        return false;
      },
      media: query,
      onchange: null,
      addListener: vi.fn((cb: (e: MediaQueryListEvent) => void) => {
        mediaListeners.push(cb);
      }),
      removeListener: vi.fn((cb: (e: MediaQueryListEvent) => void) => {
        mediaListeners = mediaListeners.filter((fn) => fn !== cb);
      }),
      addEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') mediaListeners.push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') mediaListeners = mediaListeners.filter((fn) => fn !== cb);
      }),
      dispatchEvent: vi.fn(),
    })),
  });
}

function ThemeProbe({ onReady }: { onReady: (api: ReturnType<typeof useTheme>) => void }) {
  const api = useTheme();
  React.useEffect(() => {
    onReady(api);
  });
  return <div data-testid="probe">{api.theme}:{api.resolvedTheme}</div>;
}

describe('ZenThemeProvider — Rocket Loader opt-out, CSP nonce & cross-route system theme', () => {
  beforeEach(() => {
    installMatchMediaStub(false); // OS prefers LIGHT by default in stub
    window.localStorage.clear();
    document.documentElement.className = '';
  });

  it('emits data-cfasync="false" alongside the per-request CSP nonce when rendered on the server (typeof window === "undefined")', () => {
    const savedWindow = globalThis.window;
    try {
      // Simulate real Next.js SSR where typeof window === "undefined" so next-themes
      // emits the raw `nonce` attribute rather than the post-hydration empty string.
      Reflect.deleteProperty(globalThis, 'window');
      const html = renderToStaticMarkup(
        <ZenThemeProvider defaultTheme="dark" nonce="req-nonce-9f4e2a1b">
          <main>content</main>
        </ZenThemeProvider>,
      );

      expect(html).toContain('<script');
      expect(html).toContain('data-cfasync="false"');
      expect(html).toContain('nonce="req-nonce-9f4e2a1b"');
      expect(html).toContain('sophia-zen-theme');
    } finally {
      globalThis.window = savedWindow;
    }
  });

  it('preserves data-cfasync="false" and defaults fresh visitors to dark even when OS prefers light', () => {
    installMatchMediaStub(false); // OS prefers light, storage is empty
    const { container } = render(
      <ZenThemeProvider defaultTheme="dark" nonce="client-nonce-abc123">
        <div>shell</div>
      </ZenThemeProvider>,
    );

    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    expect(script?.getAttribute('data-cfasync')).toBe('false');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('persists "system" in sophia-zen-theme and keeps live OS matchMedia sync across route mounts', () => {
    installMatchMediaStub(false); // OS prefers light
    let latestApi: ReturnType<typeof useTheme> | undefined;

    render(
      <ZenThemeProvider defaultTheme="dark" nonce="nonce-sys-1">
        <ThemeProbe onReady={(api) => { latestApi = api; }} />
      </ZenThemeProvider>,
    );

    act(() => {
      latestApi?.setTheme('system');
    });

    expect(window.localStorage.getItem('sophia-zen-theme')).toBe('system');
    expect(document.documentElement.classList.contains('light')).toBe(true);

    // Simulate OS switching to dark while user is on any route (outside /settings)
    act(() => {
      osPrefersDark = true;
      for (const listener of [...mediaListeners]) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(window.localStorage.getItem('sophia-zen-theme')).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
