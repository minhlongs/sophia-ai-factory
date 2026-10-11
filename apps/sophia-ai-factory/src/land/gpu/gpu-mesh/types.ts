export interface ActionError {
  code:
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'DB_ERROR'
    | 'EXECUTION_ERROR';
  message: string;
}

export type {
  VideoRenderJobInput,
  DispatchResult,
  GpuMeshTopology,
  SlaPenaltyEscrow,
  SlaPenaltyEscrowDbRow,
  PenaltyClaimResult,
} from '@/seed/types/edge-gpu-mesh';
