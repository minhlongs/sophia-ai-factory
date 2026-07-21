/**
 * mode — trifurcated runtime modes shared by agents + sessions.
 */

export type ModeChoice = 'lambda' | 'phi' | 'mu'
export type ModeConstraint = 'write' | 'read-write' | 'read-only'
export type ModeState = 'creation' | 'ready' | 'auditing' | 'frozen'

export interface ModeCtx {
  choice: ModeChoice
  state: ModeState
  allowedConstraints: ModeConstraint[]
}

export function enforce(ctx: ModeCtx, requested: ModeConstraint): void {
  if (!ctx.allowedConstraints.includes(requested)) {
    throw new Error(`mode ${ctx.choice}: ${requested} not allowed (allowed: ${ctx.allowedConstraints.join(',')})`)
  }
}
