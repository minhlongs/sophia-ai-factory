/**
 * Unit tests — attestation-verifier
 * Tasks #88, #92, #47
 */

import { describe, it, expect } from 'vitest'
import { verifySignature, computeSignature } from '../manifest-generator'
import { createManifest } from '../manifest-generator'

describe('attestation-verifier', () => {
  const secret = 'my-secret-key'
  const payload = {
    commitSha: 'abc123',
    branch: 'main',
    operatorHost: 'host',
    operatorUser: 'user',
    diffSummary: 'test',
    filesChanged: 1
  }

  it('computes signature consistent with manifest', async () => {
    const manifest = createManifest(payload)
    const sig = await computeSignature(manifest, secret)
    expect(sig).toHaveLength(64) // hex string
  })

  it('verifies a valid signature', async () => {
    const manifest = createManifest(payload)
    const sig = await computeSignature(manifest, secret)
    const isValid = await verifySignature(manifest, sig, secret)
    expect(isValid).toBe(true)
  })

  it('rejects an invalid signature', async () => {
    const manifest = createManifest(payload)
    const invalidSig = '0'.repeat(64)
    const isValid = await verifySignature(manifest, invalidSig, secret)
    expect(isValid).toBe(false)
  })
})
