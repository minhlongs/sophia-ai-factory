export interface CostEstimate {
  amount: number;
  unit: string;
  confidence: 'estimated' | 'exact' | 'unavailable';
  breakdown?: Record<string, unknown>;
  duration?: number;
}
