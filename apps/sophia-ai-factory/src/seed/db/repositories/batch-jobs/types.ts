export interface BatchJob {
  id: string;
  user_id: string;
  name: string;
  status: string;
  total_videos: number;
  completed_videos: number;
  failed_videos: number;
  estimated_cost_cents: number;
  actual_cost_cents: number;
  input_r2_key: string | null;
  idempotency_key?: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CreateBatchJobResult {
  job: BatchJob;
  created: boolean;
}

export interface CreateBatchJobInput {
  userId: string;
  name: string;
  totalVideos: number;
  estimatedCostCents: number;
  inputR2Key?: string;
  idempotencyKey?: string;
}

export interface BatchVideo {
  id: string;
  batch_id: string;
  row_index: number;
  status: string;
  mission_id: string | null;
  input_data: string;
  output_video_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
