/**
 * Safe catch — never silently swallow errors.
 *
 * Phase 4 (Error Handling Overhaul): replaces empty `catch {}` blocks
 * with a standard pattern that always logs. Callers may pass an optional
 * `onError` callback for metrics/custom handling without importing from tree.
 *
 * @module seed/utils/safe-catch
 */

import { logger } from '@/seed/utils/logger-utility'

/**
 * Returns a catch handler that logs the error with context.
 * Never throws — designed for non-fatal error paths.
 *
 * @example
 * ```ts
 * try { await nonFatalOp() } catch (e) { safeCatch('Stale lock update')(e) }
 * // or with callback:
 * try { await nonFatalOp() } catch (e) { safeCatch('DLQ enqueue', trackDlqOverflow)(e) }
 * ```
 */
export function safeCatch(context: string, onError?: (e: unknown) => void) {
  return (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn(`[Non-fatal] ${context}: ${msg}`)
    onError?.(err)
  }
}
