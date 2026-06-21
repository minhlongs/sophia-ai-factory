/**
 * E2E — Deploy Guard Approval Flow
 * Tasks #88, #92
 *
 * Tests the full create-approval + attest flow:
 *  1. Admin creates approval (POST /api/admin/deploy-guard/create-approval)
 *  2. Admin attests to the approval (POST /api/admin/deploy-guard/attest)
 *  3. Verify approval status becomes 'approved' (quorum reached)
 *
 * Also verifies operator identification is correctly extracted from session.
 *
 * Run: npm run test:e2e -- deploy-guard-flow
 * Env: E2E_TEST_USER_PASSWORD must be set (bootstrap via npm run e2e:bootstrap-user)
 */

import { test, expect } from './fixtures/auth-fixture'

test.describe('Deploy Guard Approval Flow', () => {
  test('admin creates approval and attests to reach quorum', async ({ authenticatedPage, testUser }) => {
    // Step 1: Create a pending approval with requiredAttestations=1
    const createBody = {
      commitSha: 'abc123def456',
      branch: 'main',
      operatorHost: 'sophia.agencyos.network',
      diffSummary: 'Update README.md',
      filesChanged: 1,
      requiredAttestations: 1
    }

    const createResp = await authenticatedPage.request.post('/api/admin/deploy-guard/create-approval', {
      data: createBody
    })

    expect(createResp.ok(), 'create-approval should return 2xx').toBeTruthy()
    const createData = await createResp.json() as { approvalId: string; status: string }
    expect(createData).toHaveProperty('approvalId')
    expect(createData.status).toBe('pending')

    const approvalId = createData.approvalId

    // Step 2: Verify the approval record has correct operatorUser (from session)
    const getApprovalResp = await authenticatedPage.request.get(`/api/admin/deploy-guard/approvals/${approvalId}`)
    expect(getApprovalResp.ok()).toBeTruthy()
    const approval = await getApprovalResp.json() as any
    expect(approval.operatorUser).toBe(testUser.signIn.userId) // operatorUser should be the admin's user ID
    expect(approval.requiredAttestations).toBe(1)
    expect(approval.attestationCount).toBe(0)

    // Step 3: Attest to the approval (any signature is accepted)
    const attestBody = {
      approvalId,
      signature: '0x' + 'a'.repeat(64) // dummy signature
    }
    const attestResp = await authenticatedPage.request.post('/api/admin/deploy-guard/attest', {
      data: attestBody
    })
    expect(attestResp.ok(), 'attest should return 2xx').toBeTruthy()
    const attestData = await attestResp.json() as { success: boolean; quorumReached: boolean; remaining: number }
    expect(attestData.success).toBe(true)
    expect(attestData.quorumReached).toBe(true)
    expect(attestData.remaining).toBe(0)

    // Step 4: Verify approval status is now approved
    const getAgainResp = await authenticatedPage.request.get(`/api/admin/deploy-guard/approvals/${approvalId}`)
    expect(getAgainResp.ok()).toBeTruthy()
    const updatedApproval = await getAgainResp.json() as any
    expect(updatedApproval.status).toBe('approved')
    expect(updatedApproval.attestationCount).toBe(1)

    // Step 5: Verify attestation appears in audit log / history
    const historyResp = await authenticatedPage.request.get('/api/admin/deploy-guard/history?limit=20')
    expect(historyResp.ok()).toBeTruthy()
    const historyData = await historyResp.json() as { entries: Array<{ action: string; operator_id: string; commit_sha?: string }> }
    const attestEvent = historyData.entries.find(e => e.action === 'attested' && e.commit_sha === createBody.commitSha)
    expect(attestEvent).toBeDefined()
    expect(attestEvent?.operator_id).toBe(testUser.signIn.userId)
  })
})
