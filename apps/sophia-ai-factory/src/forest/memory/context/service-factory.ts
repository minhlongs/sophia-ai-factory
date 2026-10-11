import { ContextWindowOptions } from './constants-and-types';
import { ContextWindowService } from './context-window-manager';

let contextWindowServiceInstance: ContextWindowService | null = null;

/**
 * Get the singleton ContextWindowService instance.
 * Creates one with default options if not yet initialized.
 */
export function getContextWindowService(
  options?: ContextWindowOptions,
): ContextWindowService {
  if (!contextWindowServiceInstance) {
    contextWindowServiceInstance = new ContextWindowService(options);
  }
  return contextWindowServiceInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetContextWindowService(): void {
  contextWindowServiceInstance = null;
}
