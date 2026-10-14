export interface BufferStats {
  size: number;
  isFlushing: boolean;
}

export interface BufferOptions {
  maxBatchSize?: number;
  flushDelayMs?: number;
}
