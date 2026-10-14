/**
 * Console output suppression for test suite
 */

import { vi } from 'vitest';

export function suppressConsoleOutput(): void {
  globalThis.console = {
    ...globalThis.console,
    warn: vi.fn(),
    log: vi.fn(),
    error: globalThis.console.error,
  };
}
