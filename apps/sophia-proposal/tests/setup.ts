import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IntersectionObserver for JSDOM
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  constructor(private callback: IntersectionObserverCallback) {}
  observe() { /* no-op */ }
  unobserve() { /* no-op */ }
  disconnect() { /* no-op */ }
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true,
});

// Mock next/font/google
vi.mock('next/font/google', () => ({
  Inter: vi.fn(() => ({
    className: 'font-inter',
    variable: '--font-inter',
  })),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: vi.fn((props) => {
    const { src, alt, ...rest } = props;
    return {
      type: 'img',
      props: {
        src,
        alt,
        ...rest,
      },
    };
  }),
}));

// Mock next/navigation - useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));
