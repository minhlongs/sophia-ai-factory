/**
 * Unit tests — manifest-generator
 * Tasks #88, #92, #47
 */

import { describe, it, expect } from 'vitest'
import { createManifest, getSigningString, generateApprovalId, generateAttestationId, computeSignature } from '../manifest-generator'

describe('manifest-generator', () => {
  describe('createManifest', () => {
    it('creates deterministic manifest with required fields', () => {
      const payload = {
        commitSha: 'abc123def456',
        branch: 'main',
        operatorHost: 'operator-laptop',
        operatorUser: 'alice',
        diffSummary: '10 files changed',
        filesChanged: 10
      }
      const manifest = createManifest(payload, 2)

      expect(manifest.commit_sha).toBe('abc123def456')
      expect(manifest.branch).toBe('main')
      expect(manifest.operator_host).toBe('operator-laptop')
      expect(manifest.operator_user).toBe('alice')
      expect(manifest.diff_summary).toBe('10 files changed')
      expect(manifest.files_changed).toBe(10)
      expect(manifest.required_attestations).toBe(2)
      expect(manifest.timestamp).toBeDefined()
    })

    it('defaults requiredAttestations to 2', () => {
      const payload = {
        commitSha: 'abc123',
        branch: 'main',
        operatorHost: 'host',
        operatorUser: 'user',
        diffSummary: '',
        filesChanged: 0
      }
      const manifest = createManifest(payload)
      expect(manifest.required_attestations).toBe(2)
    })
  })

  describe('getSigningString', () => {
    it('produces canonical JSON with sorted keys', () => {
      const manifest = {
        branch: 'main',
        commit_sha: 'abc123',
        diff_summary: '',
        files_changed: 0,
        operator_host: 'host',
        operator_user: 'user',
        required_attestations: 2,
        timestamp: '2025-01-01T00:00:00Z'
      }
      const signingStr = getSigningString(manifest)

      // Parse and check keys order
      const parsed = JSON.parse(signingStr)
      const keys = Object.keys(parsed)
      const sortedKeys = [...keys].sort()
      expect(keys).toEqual(sortedKeys)
    })
  })

  describe('computeSignature', () => {
    it('computes consistent HMAC-SHA256 signature', async () => {
      const manifest = {
        commit_sha: 'abc123',
        branch: 'main',
        timestamp: '2025-01-01T00:00:00Z',
        operator_host: 'host',
        operator_user: 'user',
        diff_summary: '',
        files_changed: 0,
        required_attestations: 2
      }
      const secret = 'test-secret-key'
      const sig1 = await computeSignature(manifest, secret)
      const sig2 = await computeSignature(manifest, secret)

      expect(sig1).toBe(sig2)
      expect(sig1).toHaveLength(64) // 32 bytes hex = 64 chars
    })
  })

  describe('generateApprovalId', () => {
    it('generates unique IDs', () => {
      const id1 = generateApprovalId()
      const id2 = generateApprovalId()
      expect(id1).not.toBe(id2)
    })

    it('starts with approval_', () => {
      const id = generateApprovalId()
      expect(id.startsWith('approval_')).toBe(true)
    })
  })

  describe('generateAttestationId', () => {
    it('generates unique IDs', () => {
      const id1 = generateAttestationId()
      const id2 = generateAttestationId()
      expect(id1).not.toBe(id2)
    })

    it('starts with attest_', () => {
      const id = generateAttestationId()
      expect(id.startsWith('attest_')).toBe(true)
    })
  })
})
