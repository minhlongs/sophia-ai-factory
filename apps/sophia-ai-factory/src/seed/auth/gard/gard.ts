/**
 * gard — async authorization guard for Cloudflare Workers.
 *
 * Supports role-based access (admin / user / read-only) and
 * resource-scoped rules.  Used to protect Telegram webhooks and
 * API routes at the handler level.
 */

export type GardRole = 'admin' | 'editor' | 'viewer' | 'anonymous'
export type GardAction = 'read' | 'write' | 'delete' | 'admin'

export interface GardContext {
  role: GardRole
  subjectId?: string
  scopes?: string[]
}

export interface GardRule {
  action: GardAction
  resource: string
  allowRoles: GardRole[]
}

export const DEFAULT_RULES: GardRule[] = [
  { action: 'admin', resource: '*', allowRoles: ['admin'] },
  { action: 'write', resource: '*', allowRoles: ['admin', 'editor'] },
  { action: 'read', resource: '*', allowRoles: ['admin', 'editor', 'viewer'] },
]

export function createContext(role: GardRole, opts: Partial<GardContext> = {}): GardContext {
  return { role, ...opts }
}

export function allowed(ctx: GardContext, action: GardAction, resource: string, rules: GardRule[] = DEFAULT_RULES): boolean {
  for (const rule of rules) {
    if (rule.action !== action && rule.action !== 'admin' && !(action === 'read' && rule.action === 'write')) continue
    if (rule.resource !== '*' && rule.resource !== resource) continue
    if (rule.allowRoles.includes(ctx.role)) return true
  }
  return false
}

export class GuardError extends Error {
  constructor(public readonly action: GardAction, public readonly resource: string) {
    super(`forbidden: ${action} on ${resource}`)
    this.name = 'GuardError'
  }
}

export function guard(ctx: GardContext, action: GardAction, resource: string, rules?: GardRule[]): void {
  if (!allowed(ctx, action, resource, rules)) {
    throw new GuardError(action, resource)
  }
}
