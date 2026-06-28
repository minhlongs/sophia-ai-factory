/**
 * Integration tests — Deploy Guard API
 * Tasks #88, #92, #47
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST as CreateApprovalPOST } from '../create-approval/route'
import { GET as PendingGET } from '../pending/route'
import { POST as RejectPOST } from '../reject/route'

// Mock the approvalService
vi.mock('@/forest/deploy-guard', () => ({
  approvalService: {
    createApproval: vi.fn(),
    listPending: vi.fn(),
    rejectApproval: vi.fn(),
    attest: vi.fn()
  }
}))

vi.mock('@/seed/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
  requireAdminOrDeploy: vi.fn()
}))

describe('Deploy Guard API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/admin/deploy-guard/create-approval', () => {
    it('creates approval and returns 201', async () => {
      const mockAuth = { userId: 'admin1', isDeployToken: false }
      const { requireAdminOrDeploy } = await import('@/seed/auth/require-admin')
      ;(requireAdminOrDeploy as any).mockResolvedValue(mockAuth)

      const { approvalService } = await import('@/forest/deploy-guard')
      ;(approvalService.createApproval as any).mockResolvedValue({
        approvalId: 'abc123',
        status: 'pending'
      })

      const body = {
        commitSha: 'abc123',
        branch: 'main',
        operatorHost: 'host',
        operatorUser: 'alice',
        diffSummary: '1 file',
        filesChanged: 1
      }
      const request = new NextRequest('http://localhost/api/admin/deploy-guard/create-approval', {
        method: 'POST',
        body: JSON.stringify(body)
      })
      request.headers.set('Content-Type', 'application/json')

      const response = await CreateApprovalPOST(request)
      expect(response.status).toBe(201)
      const data = await response.json() as { approvalId: string; status: string }
      expect(data.approvalId).toBe('abc123')
    })

    it('returns 401 if unauthorized', async () => {
      const { requireAdminOrDeploy } = await import('@/seed/auth/require-admin')
      const errorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      ;(requireAdminOrDeploy as any).mockResolvedValue(errorResponse)

      const body = {
        commitSha: 'abc123',
        branch: 'main',
        operatorHost: 'host',
        operatorUser: 'alice'
      }
      const request = new NextRequest('http://localhost/api/admin/deploy-guard/create-approval', {
        method: 'POST',
        body: JSON.stringify(body)
      })
      request.headers.set('Content-Type', 'application/json')

      const response = await CreateApprovalPOST(request)
      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/admin/deploy-guard/pending', () => {
    it('lists pending approvals', async () => {
      const mockAuth = { user: { id: 'admin1' } }
      const { requireAdmin } = await import('@/seed/auth/require-admin')
      ;(requireAdmin as any).mockResolvedValue(mockAuth)

      const { approvalService } = await import('@/forest/deploy-guard')
      const mockApprovals = [
        {
          id: 'id1',
          commitSha: 'abc123',
          branch: 'main',
          operatorHost: 'host',
          operatorUser: 'alice',
          status: 'pending',
          attestationCount: 0,
          requiredAttestations: 2,
          createdAt: Math.floor(Date.now() / 1000)
        }
      ]
      ;(approvalService.listPending as any).mockResolvedValue(mockApprovals)

      const request = new NextRequest('http://localhost/api/admin/deploy-guard/pending?limit=10')
      const response = await PendingGET(request)
      expect(response.status).toBe(200)
      const data = await response.json() as { approvals: any[]; count: number; limit: number; offset: number }
      expect(data.approvals).toHaveLength(1)
    })
  })

  describe('POST /api/admin/deploy-guard/reject', () => {
    it('rejects a pending approval', async () => {
      const mockAuth = { user: { id: 'admin1' } }
      const { requireAdmin } = await import('@/seed/auth/require-admin')
      ;(requireAdmin as any).mockResolvedValue(mockAuth)

      const { approvalService } = await import('@/forest/deploy-guard')
      ;(approvalService.rejectApproval as any).mockResolvedValue(undefined)

      const body = {
        approvalId: 'approval123',
        reason: 'Not ready for production'
      }
      const request = new NextRequest('http://localhost/api/admin/deploy-guard/reject', {
        method: 'POST',
        body: JSON.stringify(body)
      })
      request.headers.set('Content-Type', 'application/json')

      const response = await RejectPOST(request)
      expect(response.status).toBe(200)
      const data = await response.json() as { success: boolean }
      expect(data.success).toBe(true)
      expect(approvalService.rejectApproval).toHaveBeenCalledWith('approval123', 'admin1', 'Not ready for production')
    })

    it('returns 400 if missing fields', async () => {
      const mockAuth = { user: { id: 'admin1' } }
      const { requireAdmin } = await import('@/seed/auth/require-admin')
      ;(requireAdmin as any).mockResolvedValue(mockAuth)

      const request = new NextRequest('http://localhost/api/admin/deploy-guard/reject', {
        method: 'POST',
        body: JSON.stringify({ approvalId: 'approval123' }) // missing reason
      })
      request.headers.set('Content-Type', 'application/json')

      const response = await RejectPOST(request)
      expect(response.status).toBe(400)
    })

    it('returns 401 if unauthorized', async () => {
      const { requireAdmin } = await import('@/seed/auth/require-admin')
      const errorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      ;(requireAdmin as any).mockResolvedValue(errorResponse)

      const request = new NextRequest('http://localhost/api/admin/deploy-guard/reject', {
        method: 'POST',
        body: JSON.stringify({ approvalId: 'abc', reason: 'test' })
      })
      request.headers.set('Content-Type', 'application/json')

      const response = await RejectPOST(request)
      expect(response.status).toBe(401)
    })
  })
})
