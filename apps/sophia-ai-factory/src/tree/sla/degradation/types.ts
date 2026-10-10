export interface EvaluateSlaOptions {
  windowSeconds?: number;
  nowSeconds?: number;
  reservationId?: string;
}

export interface JobSliRow {
  status: string;
  execution_latency_ms: number | null;
  failover_hops: number | null;
}
