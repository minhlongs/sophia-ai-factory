/**
 * Checkpoint Persistence — wrapper re-export from seed layer
 *
 * Forest layer imports checkpoint functions from seed/ (canonical location).
 * This file provides backward compatibility for imports from forest/.
 */

export {
  saveMissionCheckpoint,
  loadMissionCheckpoint,
  clearMissionCheckpoint,
  type CheckpointData,
  type StepCheckpoint,
} from '@/seed/missions/checkpoint'
