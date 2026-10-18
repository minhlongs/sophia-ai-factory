/**
 * ID Generation Utilities for AI Provider Abstraction Layer
 *
 * @module tree/ai-providers/id-generator
 */

let providerSeq = 0
let requestSeq = 0
let baseTs = Date.now()

/**
 * Generate a provider ID — `prv_<timestamp>_<seq>`.
 * Resets sequence when timestamp advances to avoid collisions.
 */
export function newProviderId(): string {
  const now = Date.now()
  if (now !== baseTs) {
    baseTs = now
    providerSeq = 0
  }
  providerSeq++
  return `prv_${now}_${providerSeq}`
}

/**
 * Generate a request ID — `req_<timestamp>_<seq>`.
 * Resets sequence when timestamp advances to avoid collisions.
 */
export function newAIRequestId(): string {
  const now = Date.now()
  if (now !== baseTs) {
    baseTs = now
    requestSeq = 0
  }
  requestSeq++
  return `req_${now}_${requestSeq}`
}
