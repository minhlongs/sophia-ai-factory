/// <reference types="vitest/globals" />
// Test setup for Sophia Proposal
import '@testing-library/jest-dom';

// Mock IntersectionObserver for jsdom environment
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const cleanup = () => {};
