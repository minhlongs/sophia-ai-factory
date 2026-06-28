/**
 * Tree wrapper: re-export checkpoint persistence from seed layer
 * (moved from forest to respect 4-layer architecture: tree → seed only)
 */
export {
  saveMissionCheckpoint,
  loadMissionCheckpoint,
  clearMissionCheckpoint,
  type CheckpointData,
} from '@/seed/missions/checkpoint';
