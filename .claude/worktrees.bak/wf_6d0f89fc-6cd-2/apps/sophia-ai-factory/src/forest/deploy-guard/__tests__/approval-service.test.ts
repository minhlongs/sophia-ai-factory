/**
 * Unit tests — approval-service (mocked DB)
 * Tasks #88, #92, #47
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApprovalService } from '../approval-service'
import { DeployApproval } from '../types'

// Mock the D1 client with proper chaining (prepare -> bind -> {run,first,all})
const createMockDb = () => {
  const bindChain = {
    run: vi.fn(),
    first: vi.fn(),
    all: vi.fn()
  }
  const prepare = vi.fn(() => ({
    bind: vi.fn(() => bindChain)
  }))
  return { prepare, bindChain }
}

let mockDb: ReturnType<typeof createMockDb>

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => mockDb)
}))

describe('approval-service', () => {
  let service: ApprovalService

  beforeEach(() => {
    mockDb = createMockDb()
    service = new ApprovalService()
    vi.clearAllMocks()
  })

  describe('createApproval', () => {
    it('creates a pending approval record', async () => {
      const now = Math.floor(Date.now() / 1000)
      // Mock the INSERT's run() to succeed
      mockDb.bindChain.run.mockReturnValue({ success: true } as any)

      const result = await service.createApproval({
        commitSha: 'abc123',
        branch: 'main',
        operatorHost: 'host',
        operatorUser: 'alice',
        diffSummary: '1 file changed',
        filesChanged: 1,
        requiredAttestations: 2
      })

      expect(result.approvalId).toBeDefined()
      expect(result.status).toBe('pending')
      expect(mockDb.bindChain.run).toHaveBeenCalled()
      // Verify the INSERT includes the new columns
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('diff_summary')
      )
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('files_changed')
      )
    })
  })

  describe('getApproval', () => {
    it('returns null if not found', async () => {
      mockDb.bindChain.first.mockReturnValue(undefined)

      const result = await service.getApproval('nonexistent')
      expect(result).toBeNull()
    })

    it('returns approval with attestations if found', async () => {
      const mockApproval: DeployApproval = {
        id: 'test-id',
        commitSha: 'abc123',
        branch: 'main',
        operatorHost: 'host',
        operatorUser: 'alice',
        status: 'pending',
        attestationCount: 1,
        requiredAttestations: 2,
        skipAttestation: false,
        skipReason: null,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
        expiresAt: null,
        diff_summary: 'test diff',
        files_changed: 1
      }
      const mockAttestations = [
        {
          id: 'att1',
          approvalId: 'test-id',
          operatorId: 'op1',
          signature: 'sig1',
          operatorHost: 'host1',
          signedAt: Math.floor(Date.now() / 1000)
        }
      ]

      // First call: SELECT * FROM deploy_guard_approvals
      mockDb.bindChain.first.mockReturnValueOnce(mockApproval)
      // Second call: SELECT * FROM deploy_attestations
      mockDb.bindChain.all.mockReturnValueOnce(mockAttestations)

      const result = await service.getApproval('test-id')
      expect(result).toEqual({
        ...mockApproval,
        attestations: mockAttestations,
        remainingAttestations: 1
      })
    })
  })

  describe('isDeploymentAllowed', () => {
    it('allows if override exists', async () => {
      // Override query returns a row
      mockDb.bindChain.first.mockReturnValueOnce({ id: 'ov1' }) // override exists
      const result = await service.isDeploymentAllowed('abc123')
      expect(result.allowed).toBe(true)
    })

    it('blocks if approval is pending with remaining attestations', async () => {
      // No override
      mockDb.bindChain.first.mockReturnValueOnce(undefined)
      // Approval query: pending
      mockDb.bindChain.first.mockReturnValueOnce({
        status: 'pending',
        requiredAttestations: 2,
        attestationCount: 1
      } as DeployApproval)
      const result = await service.isDeploymentAllowed('abc123')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('needs 1 more')
    })

    it('allows if approval is approved', async () => {
      mockDb.bindChain.first.mockReturnValueOnce(undefined) // override
      mockDb.bindChain.first.mockReturnValueOnce({
        status: 'approved'
      } as DeployApproval)
      const result = await service.isDeploymentAllowed('abc123')
      expect(result.allowed).toBe(true)
    })

    it('blocks if approval is rejected', async () => {
      mockDb.bindChain.first.mockReturnValueOnce(undefined) // override
      mockDb.bindChain.first.mockReturnValueOnce({
        status: 'rejected'
      } as DeployApproval)
      const result = await service.isDeploymentAllowed('abc123')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('rejected')
    })
  })

  describe('rejectApproval', () => {
    it('should reject a pending approval', async () => {
      const now = Math.floor(Date.now() / 1000)
      // Mock approval for SELECT
      mockDb.bindChain.first.mockReturnValueOnce({
        id: 'approval123',
        commitSha: 'def456',
        branch: 'main',
        operatorHost: 'host2',
        operatorUser: 'user2',
        status: 'pending',
        attestationCount: 0,
        requiredAttestations: 2,
        skipAttestation: false,
        skipReason: null,
        createdAt: now,
        updatedAt: now,
        expiresAt: null
      } as DeployApproval)
      // Mock UPDATE run
      mockDb.bindChain.run.mockReturnValue({ success: true } as any)

      await service.rejectApproval('approval123', 'rejecter', 'Testing rejection')

      // Verify UPDATE was called (there should be at least one UPDATE query)
      const calls = mockDb.prepare.mock.calls as any[][]
      const updateCalls = calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('UPDATE deploy_guard_approvals')
      )
      expect(updateCalls.length).toBeGreaterThan(0)
      expect(mockDb.bindChain.run).toHaveBeenCalled()
    })

    it('should throw if approval not found', async () => {
      mockDb.bindChain.first.mockReturnValue(undefined)
      await expect(service.rejectApproval('nonexistent', 'admin', 'reason'))
        .rejects.toThrow('Approval not found')
    })

    it('should throw if approval is not pending', async () => {
      mockDb.bindChain.first.mockReturnValue({
        id: 'test-id',
        status: 'approved'
      } as DeployApproval)

      await expect(service.rejectApproval('test-id', 'admin', 'reason'))
        .rejects.toThrow(/status is approved/)
    })
  })

  describe('auditEvent', () => {
    it('should insert into admin_audit_log', async () => {
      mockDb.bindChain.run.mockReturnValue({ success: true } as any)

      // Directly call auditEvent
      await service['auditEvent']({
        approvalId: 'test-approval',
        action: 'test',
        operatorId: 'test-op',
        operatorName: 'Test Operator',
        reason: 'Test reason',
        metadata: { test: true }
      })

      // Check that INSERT into admin_audit_log was attempted
      const calls = mockDb.prepare.mock.calls as any[][]
      const insertCalls = calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('INSERT INTO admin_audit_log')
      )
      expect(insertCalls.length).toBeGreaterThan(0)
    })
  })
})
