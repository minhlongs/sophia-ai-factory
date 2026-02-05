import {
  DEFAULT_CONFIG,
  type ScorableProduct,
  type ScoreResult
} from './types'
import {
  normalizeCommission,
  normalizeClickBankGravity,
  normalizeShareASaleRank,
  normalizeReliability
} from './normalization'

export class ScoringService {
  constructor(private config = DEFAULT_CONFIG) {}

  calculateScore(product: ScorableProduct): ScoreResult {
    const { weights } = this.config

    // 1. Commission Score
    const nComm = normalizeCommission(product.avg_earnings_usd)

    // 2. Popularity Score
    let nPop = 0
    if (product.network_id === 'clickbank') {
      nPop = normalizeClickBankGravity(product.raw_metrics.gravity)
    } else if (product.network_id === 'shareasale') {
      nPop = normalizeShareASaleRank(product.raw_metrics.powerRank || product.raw_metrics.rank)
    } else {
      nPop = 50 // Default
    }

    // 3. Reliability Score
    const nRel = normalizeReliability(product.raw_metrics)

    // Weighted Sum
    let score = (nComm * weights.commission) +
                (nPop * weights.popularity) +
                (nRel * weights.reliability)

    // Velocity Boost (Placeholder for MVP)
    // In full version, we check history. For now, we assume stable.
    // if (velocity > threshold) score *= this.config.boosts.velocity

    // Cap at 100
    score = Math.min(score, 100)
    score = Math.max(score, 0) // Should not be negative

    // Hidden Gem Detection
    // Criteria:
    // - Decent score (> 60)
    // - High Commission potential (> $40)
    // - NOT saturated (Popularity is moderate, not MAX)
    // - e.g., Gravity between 20 and 100 (Not 500+)

    let isHiddenGem = false

    // Simple gem logic for MVP
    if (score >= 60 && nComm > 40 && nPop < 85 && nPop > 30) {
      isHiddenGem = true
    }

    return {
      sps_score: Number(score.toFixed(2)),
      is_hidden_gem: isHiddenGem,
      components: {
        commission: nComm,
        popularity: nPop,
        reliability: nRel
      }
    }
  }
}

export const scoringService = new ScoringService()
