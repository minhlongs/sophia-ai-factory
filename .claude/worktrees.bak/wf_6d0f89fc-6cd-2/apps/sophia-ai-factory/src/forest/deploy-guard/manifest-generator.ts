/**
 * Manifest Generator — creates deterministic manifest for operator attestation
 * Tasks #88, #92, #47
 *
 * The manifest is a JSON structure that operators sign with HMAC-SHA256.
 * It must be reproducible exactly by both deploy-with-sha.sh and UI.
 */

import { DeployManifest, CreateApprovalPayload } from './types'

/**
 * Generate a canonical JSON string for signing.
 * Uses sorted keys, no whitespace, consistent timestamp format.
 */
export function canonicalize(obj: any): string {
  return JSON.stringify(obj, Object.keys(obj).sort())
}

/**
 * Create deploy manifest for signing.
 * This is the exact structure that operators will HMAC-sign with their DEPLOY_KEY.
 */
export function createManifest(
  payload: CreateApprovalPayload,
  requiredAttestations: number = 2
): DeployManifest {
  return {
    commit_sha: payload.commitSha,
    branch: payload.branch,
    timestamp: new Date().toISOString(),
    operator_host: payload.operatorHost,
    operator_user: payload.operatorUser,
    diff_summary: payload.diffSummary,
    files_changed: payload.filesChanged,
    required_attestations: requiredAttestations
  }
}

/**
 * Generate the manifest string that should be signed.
 * Operators will compute HMAC-SHA256 of this string with their secret key.
 */
export function getSigningString(manifest: DeployManifest): string {
  // Canonical JSON with sorted keys
  return canonicalize(manifest)
}

/**
 * Compute expected signature given manifest and secret.
 * Used by both the UI (to show operator what they're signing) and verification logic.
 */
export async function computeSignature(
  manifest: DeployManifest,
  secret: string
): Promise<string> {
  const { subtle } = globalThis.crypto
  const encoder = new TextEncoder()
  const key = await subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  const data = encoder.encode(getSigningString(manifest))
  const signatureBuffer = await subtle.sign('HMAC', key, data)
  // Convert to hex string
  const signatureArray = Array.from(new Uint8Array(signatureBuffer))
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify an operator's signature against the manifest.
 * Returns true if signature is valid.
 * Uses Web Crypto API for constant-time verification.
 */
export async function verifySignature(
  manifest: DeployManifest,
  signature: string,
  secret: string
): Promise<boolean> {
  const data = getSigningString(manifest)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  // Convert hex signature to Uint8Array
  const sigBytes = hexToUint8Array(signature)
  // @ts-expect-error Web Crypto subtle.verify accepts BufferSource; Uint8Array is valid
  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))
}

/**
 * Helper: convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i >> 1] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

/**
 * Generate a unique approval ID (UUID v4 alternative)
 */
export function generateApprovalId(): string {
  return `approval_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}

/**
 * Generate a unique attestation ID
 */
export function generateAttestationId(): string {
  return `attest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}
