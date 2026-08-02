/**
 * oracle — price / condition / raw-data feeder for treap queries.
 *
 * Ultracode uses treaps internally to rank sessions, agents, and
 * artifacts by priority.  The oracle injects weighted key streams
 * into those treaps via the Mode layer.
 */

import type { ModeChoice, ModeState } from '../core/mode/mode'

export interface OracleTick {
  agentId: string
  weight: number
  tags: string[]
  meta: Record<string, unknown>
  timestamp: number
}

export interface OracleStreamOptions {
  mode: ModeChoice
  modeState: ModeState
  maxDepth?: number
}

export function computeWeight(opts: OracleStreamOptions, tick: OracleTick): number {
  const liked = opts.modeState === 'creation' ? 0.8 : opts.modeState === 'auditing' ? 0.3 : 1.0
  return tick.weight * liked
}

export function triage(ticks: OracleTick[], opts: OracleStreamOptions): OracleTick[] {
  const scored = ticks.map(t => ({ tick: t, score: computeWeight(opts, t) }))
  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.tick)
}
