/**
 * @sophia/raas-sdk — Public API surface.
 */

// Main client
export { SophiaClient } from './client';

// Resource classes (for direct instantiation / testing)
export { Missions } from './missions';

// Error class (useful for instanceof checks in consumer code)
export { RaasHttpError } from './http-client';

// All types
export type {
  SophiaClientConfig,
  WaitForResultOptions,
  Mission,
  MissionResult,
  MissionStatus,
  MissionPriority,
  MissionCommand,
  CreateMissionRequest,
  CreateMissionResponse,
  ListMissionsResponse,
  MissionResultResponse,
  MissionPendingResponse,
  CancelMissionResponse,
} from './types';
