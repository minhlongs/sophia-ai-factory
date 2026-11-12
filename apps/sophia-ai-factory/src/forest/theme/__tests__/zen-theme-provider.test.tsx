import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ZenThemeProvider } from '../zen-theme-provider';

function installMatchMediaStub() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('ZenThemeProvider — Rocket Loader opt-out & CSP nonce wiring', () => {
  beforeEach(() => {
    installMatchMediaStub();
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

  it('preserves data-cfasync="false" and applies the dark default class on client mount', () => {
    const { container } = render(
      <ZenThemeProvider defaultTheme="dark" nonce="client-nonce-abc123">
        <div>shell</div>
      </ZenThemeProvider>,
    );

    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    expect(script?.getAttribute('data-cfasync')).toBe('false');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
