export interface ScoringConfig {
  weights: {
    commission: number
    popularity: number
    reliability: number
  }
  boosts: {
    velocity: number // Multiplier, e.g., 1.2 for 20% boost
    hiddenGem: number // Threshold for hidden gem
  }
}

export const DEFAULT_CONFIG: ScoringConfig = {
  weights: {
    commission: 0.4,
    popularity: 0.3,
    reliability: 0.3
  },
  boosts: {
    velocity: 1.2,
    hiddenGem: 80 // Score > 80 is a gem? Or specific criteria?
  }
}

export interface ScorableProduct {
  network_id: 'clickbank' | 'shareasale' | 'amazon'
  avg_earnings_usd: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw_metrics: Record<string, any>
  // In real app, we would have historical metrics here too for velocity
  metric_history?: { gravity?: number[], rank?: number[] }
}

export interface ScoreResult {
  sps_score: number
  is_hidden_gem: boolean
  components: {
    commission: number
    popularity: number
    reliability: number
  }
}
