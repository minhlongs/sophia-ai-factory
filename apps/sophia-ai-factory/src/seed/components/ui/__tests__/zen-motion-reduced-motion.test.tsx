// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { FadeInView } from '../fade-in-view';
import { ScrollReveal } from '../scroll-reveal';
import { PageTransition } from '../page-transition';
import { AnimatedCounter } from '../animated-counter-with-framer-motion';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? matches : false,
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

describe('Zen Motion Primitives — prefers-reduced-motion: reduce (WCAG 2.2 SC 2.3.3)', () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it('FadeInView renders immediately visible with transition: none under reduced motion', () => {
    const { container } = render(
      <FadeInView direction="up" distance={20} duration={400}>
        <span>content</span>
      </FadeInView>,
    );
    const root = container.querySelector<HTMLElement>('[data-zen-motion="fade-in-view"]');
    expect(root).not.toBeNull();
    expect(root?.dataset.zenRevealed).toBe('true');
    expect(root?.style.opacity).toBe('1');
    expect(root?.style.transform).toBe('none');
    expect(root?.style.transition).toBe('none');
  });

  it('ScrollReveal renders immediately visible with transition: none under reduced motion', () => {
    const { container } = render(
      <ScrollReveal>
        <span>revealed</span>
      </ScrollReveal>,
    );
    const root = container.querySelector<HTMLElement>('[data-zen-motion="scroll-reveal"]');
    expect(root).not.toBeNull();
    expect(root?.dataset.zenRevealed).toBe('true');
    expect(root?.style.opacity).toBe('1');
    expect(root?.style.transform).toBe('none');
    expect(root?.style.transition).toBe('none');
  });

  it('ScrollReveal with staggerDelay renders cloned children with transition: none under reduced motion', () => {
    const { container } = render(
      <ScrollReveal staggerDelay={80} delay={40}>
        <span data-testid="child-a">first</span>
        <span data-testid="child-b">second</span>
      </ScrollReveal>,
    );
    const childA = container.querySelector<HTMLElement>('[data-testid="child-a"]');
    const childB = container.querySelector<HTMLElement>('[data-testid="child-b"]');
    expect(childA?.style.opacity).toBe('1');
    expect(childA?.style.transform).toBe('none');
    expect(childA?.style.transition).toBe('none');
    expect(childB?.style.opacity).toBe('1');
    expect(childB?.style.transform).toBe('none');
    expect(childB?.style.transition).toBe('none');
  });

  it('PageTransition renders immediately mounted with transition: none under reduced motion', () => {
    const { container } = render(
      <PageTransition>
        <span>page</span>
      </PageTransition>,
    );
    const root = container.querySelector<HTMLElement>('[data-zen-motion="page-transition"]');
    expect(root).not.toBeNull();
    expect(root?.dataset.zenRevealed).toBe('true');
    expect(root?.style.opacity).toBe('1');
    expect(root?.style.transform).toBe('none');
    expect(root?.style.transition).toBe('none');
  });

  it('AnimatedCounter jumps directly to final value without rAF loop under reduced motion', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const { container } = render(<AnimatedCounter value={12500} duration={1500} />);
    const node = container.querySelector<HTMLElement>('[data-zen-motion="animated-counter"]');
    expect(node).not.toBeNull();
    expect(node?.dataset.zenReduced).toBe('true');
    expect(node?.textContent).toBe((12500).toLocaleString());
    expect(rafSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();
  });

  it('hydrates SSR markup cleanly with zero React 19 hydration mismatch warnings under reduced motion', () => {
    const savedWindow = globalThis.window;
    let ssrHtml = '';
    const ui = (
      <div>
        <FadeInView direction="up" distance={20} duration={400}>
          <span>fade</span>
        </FadeInView>
        <ScrollReveal>
          <span>scroll</span>
        </ScrollReveal>
        <ScrollReveal staggerDelay={60}>
          <span data-testid="stagger-1">s1</span>
          <span data-testid="stagger-2">s2</span>
        </ScrollReveal>
        <PageTransition>
          <span>page</span>
        </PageTransition>
        <AnimatedCounter value={12500} duration={1500} />
      </div>
    );

    try {
      Reflect.deleteProperty(globalThis, 'window');
      ssrHtml = renderToString(ui);
    } finally {
      globalThis.window = savedWindow;
    }

    mockMatchMedia(true);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('div');
    host.innerHTML = ssrHtml;
    document.body.appendChild(host);

    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      act(() => {
        root = hydrateRoot(host, ui);
      });

      expect(errorSpy).not.toHaveBeenCalled();
      expect(host.querySelector<HTMLElement>('[data-zen-motion="fade-in-view"]')?.dataset.zenRevealed).toBe('true');
      expect(host.querySelector<HTMLElement>('[data-zen-motion="scroll-reveal"]')?.dataset.zenRevealed).toBe('true');
      expect(host.querySelector<HTMLElement>('[data-zen-motion="page-transition"]')?.dataset.zenRevealed).toBe('true');
      expect(host.querySelector<HTMLElement>('[data-zen-motion-stagger]')?.dataset.zenRevealed).toBe('true');
      const counter = host.querySelector<HTMLElement>('[data-zen-motion="animated-counter"]');
      expect(counter?.dataset.zenReduced).toBe('true');
      expect(counter?.textContent).toBe((12500).toLocaleString());
    } finally {
      act(() => {
        root?.unmount();
      });
      host.remove();
      errorSpy.mockRestore();
    }
  });

  it('AnimatedCounter cancels an in-flight rAF loop and jumps to target value when OS toggles reduced motion on mid-animation', () => {
    const changeListeners: Array<(e: MediaQueryListEvent) => void> = [];
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
          if (event === 'change' && query.includes('prefers-reduced-motion')) changeListeners.push(cb);
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const { container } = render(<AnimatedCounter value={9800} duration={2000} />);
    const node = container.querySelector<HTMLElement>('[data-zen-motion="animated-counter"]');
    expect(node?.dataset.zenReduced).toBe('false');
    expect(rafSpy).toHaveBeenCalledTimes(1);

    act(() => {
      changeListeners.forEach((cb) => cb({ matches: true } as MediaQueryListEvent));
    });
    expect(cancelSpy).toHaveBeenCalledWith(42);
    expect(node?.dataset.zenReduced).toBe('true');
    expect(node?.textContent).toBe((9800).toLocaleString());
    rafSpy.mockRestore();
    cancelSpy.mockRestore();
  });
});
