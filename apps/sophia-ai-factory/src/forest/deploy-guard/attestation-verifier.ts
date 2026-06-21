/**
 * Attestation Verifier — verify operator signatures
 * Tasks #88, #92, #47
 */

import { verifySignature, computeSignature } from './manifest-generator'
import { DeployManifest, DeployAttestation } from './types'

/**
 * Verify an attestation signature.
 * Throws Error if invalid.
 */
export async function verifyAttestation(
  manifest: DeployManifest,
  attestation: DeployAttestation,
  operatorSecret: string
): Promise<boolean> {
  return await verifySignature(manifest, attestation.signature, operatorSecret)
}

/**
 * Batch verify multiple attestations.
 * Returns count of valid signatures.
 */
export async function verifyAllAttestations(
  manifest: DeployManifest,
  attestations: DeployAttestation[],
  operatorSecrets: Map<string, string> // operatorId -> secret
): Promise<number> {
  let validCount = 0
  for (const attest of attestations) {
    const secret = operatorSecrets.get(attest.operatorId)
    if (!secret) continue
    if (await verifySignature(manifest, attest.signature, secret)) {
      validCount++
    }
  }
  return validCount
}

/**
 * Compute signature for UI attestation (client-side)
 * Note: Web Crypto API returns ArrayBuffer, convert to hex.
 */
export async function computeClientSignature(
  manifest: DeployManifest,
  secret: string
): Promise<string> {
  return await computeSignature(manifest, secret)
}
