/**
 * Creative Memory — barrel export
 * @module tree/creative-memory
 */

export {
  upsertMemory,
  getMemory,
  getMemoryByCategory,
  listMemoryKeys,
  deleteMemory,
  purgeMemory,
  recordLearning,
  newMemoryId,
} from './types';
export type { CreativeMemoryError } from './types';

export {
  computeDecayedConfidence,
  computeDecayScore,
  filterActiveMemories,
} from './decay';