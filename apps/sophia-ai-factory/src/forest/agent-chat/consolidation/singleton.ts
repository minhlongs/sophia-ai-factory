import { MemoryConsolidationService } from './service';

let consolidationServiceInstance: MemoryConsolidationService | null = null;

/**
 * Get the singleton MemoryConsolidationService instance.
 */
export function getMemoryConsolidationService(): MemoryConsolidationService {
  if (!consolidationServiceInstance) {
    consolidationServiceInstance = new MemoryConsolidationService();
  }
  return consolidationServiceInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetMemoryConsolidationService(): void {
  consolidationServiceInstance = null;
}
