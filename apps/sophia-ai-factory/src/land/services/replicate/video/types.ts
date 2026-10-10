export interface ReplicateVideoServiceConfig {
  apiKey: string;
  baseUrl?: string;
  modelOwner?: string;
  modelName?: string;
  timeoutMs?: number;
  keyRef?: string;
}

export type ReplicateJobStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export interface ReplicatePrediction {
  id: string;
  status: ReplicateJobStatus;
  output?: string | string[];
  error?: string;
  metrics?: Record<string, unknown>;
}

export interface ReplicateApiError {
  detail?: string;
  title?: string;
}

export class ReplicateClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ReplicateClientError';
  }
}
