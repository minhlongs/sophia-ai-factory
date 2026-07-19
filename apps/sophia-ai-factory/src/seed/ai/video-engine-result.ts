export interface VideoEngineResult {
  jobId: string;
  estimatedDuration: number;
  synchronous: boolean;
  videoUrl?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
}

export interface JobStatusResult {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progressPercent?: number;
  videoUrl?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  completedAt?: string;
}
