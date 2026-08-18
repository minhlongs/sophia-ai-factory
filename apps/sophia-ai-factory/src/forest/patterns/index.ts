/**
 * Pattern Detection & Playbook — Phase 5: Auto-Creative Playbook (COMPOUND stage)
 *
 * Barrel export. Layer: forest (infrastructure orchestrator).
 */

export {
  detectPatterns,
  computeConfidence,
  extractFeature,
  bucketDuration,
  bucketPostingTime,
} from './pattern-detector'
export type { PatternDetectionResult } from '@/seed/types/playbook-pattern'

export { upsertPattern, listPatterns, getTopPattern } from './pattern-store'

export { generateRuleFromPattern, generateRulesForPatterns } from './guideline-generator'

export { upsertRule, listRules, recordRollback } from './rule-store'