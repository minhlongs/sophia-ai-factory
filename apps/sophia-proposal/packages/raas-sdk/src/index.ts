/**
 * @sophia/raas-sdk — Public API surface.
 */

// Main client
export { SophiaClient } from './client.js';

// Resource classes (for direct instantiation / testing)
export { Missions } from './missions.js';

// SSE stream helper
export { MissionStream } from './stream.js';
export type { MissionStreamOptions, StreamEventHandler } from './stream.js';

// Error class (useful for instanceof checks in consumer code)
export { RaasHttpError } from './http-client.js';

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
  MissionStep,
  StreamEvent,
} from './types.js';
