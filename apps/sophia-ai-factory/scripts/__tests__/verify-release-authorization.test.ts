/**
 * Release authorization guard contract.
 *
 * The security property under test: no author-controlled input can authorize a
 * production mutation. Every path that used to be accepted — commit message marker,
 * workflow_dispatch input, repository variable — must now fail closed, and the only
 * accepted path is a live-verified Environment approval bound to this run, attempt,
 * commit, and environment.
 */
import { describe, it, expect } from 'vitest'
import {
  evaluateReleaseAuthorization,
  parseReleaseGateEvidence,
  RELEASE_ENVIRONMENT,
} from '../verify-release-authorization.mjs'

const RUN_ENV = {
  GITHUB_REPOSITORY: 'minhlongs/sophia-ai-factory',
  GITHUB_RUN_ID: '41937755192',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_SHA: '6cbfade27bb8859f26db8b545695af947a2799d9',
  GITHUB_ACTOR: 'minhlongs',
} as const

/** A gate GitHub would actually enforce: independent reviewers, no self-approval, no bypass. */
function enforcedGate(overrides: Record<string, unknown> = {}) {
  return {
    checked: true,
    repository: RUN_ENV.GITHUB_REPOSITORY,
    environment: RELEASE_ENVIRONMENT,
    runId: RUN_ENV.GITHUB_RUN_ID,
    runAttempt: RUN_ENV.GITHUB_RUN_ATTEMPT,
    sha: RUN_ENV.GITHUB_SHA,
    requiresIndependentReview: true,
    reviewerCount: 1,
    preventSelfReview: true,
    adminBypass: false,
    actor: RUN_ENV.GITHUB_ACTOR,
    ...overrides,
  } as never
}

describe('verify-release-authorization', () => {
  describe('non-mutating paths', () => {
    it('allows dry-run because it builds and verifies without mutating production', () => {
      const decision = evaluateReleaseAuthorization({ DRY_RUN: 'true' }, null)
      expect(decision.authorized).toBe(true)
      expect(decision.mode).toBe('DRY_RUN_ONLY')
    })

    it('honours the dispatch-shaped dry-run input', () => {
      const decision = evaluateReleaseAuthorization({ INPUT_DRY_RUN: 'true' }, null)
      expect(decision.mode).toBe('DRY_RUN_ONLY')
    })

    it('keeps the read-only lock blocking even when every intent signal is present', () => {
      const decision = evaluateReleaseAuthorization(
        {
          SOPHIA_PRODUCTION_READ_ONLY: '1',
          AUTHORIZE_PRODUCTION_RELEASE: 'true',
          COMMIT_MESSAGE: 'ship it [RELEASE-AUTHORIZED]',
        },
        enforcedGate()
      )
      expect(decision.authorized).toBe(false)
      expect(decision.mode).toBe('BLOCKED_READ_ONLY_MISSION')
    })
  })

  describe('previously author-controlled sources are no longer authorization', () => {
    it('grants nothing for a commit-message marker on its own', () => {
      const decision = evaluateReleaseAuthorization(
        { ...RUN_ENV, COMMIT_MESSAGE: 'feat(release): ship v1.2 [RELEASE-AUTHORIZED]' },
        enforcedGate()
      )
      expect(decision.authorized).toBe(true)
      expect(decision.mode).toBe('ENVIRONMENT_APPROVAL_BOUND')
    })

    it('grants nothing for the workflow_dispatch approval input on its own', () => {
      const decision = evaluateReleaseAuthorization(
        { ...RUN_ENV, AUTHORIZE_PRODUCTION_RELEASE: 'true' },
        null
      )
      expect(decision.authorized).toBe(false)
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_UNVERIFIED')
    })

    it('grants nothing for the repository variable token on its own', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV, SOPHIA_RELEASE_AUTHORIZED: '1' }, null)
      expect(decision.authorized).toBe(false)
    })

    it('grants nothing extra when all three intent signals are combined', () => {
      const decision = evaluateReleaseAuthorization(
        {
          ...RUN_ENV,
          AUTHORIZE_PRODUCTION_RELEASE: 'true',
          SOPHIA_RELEASE_AUTHORIZED: '1',
          COMMIT_MESSAGE: '[RELEASE-AUTHORIZED]',
        },
        enforcedGate()
      )
      expect(decision.mode).toBe('ENVIRONMENT_APPROVAL_BOUND')
      expect(decision.operatorIntent).toMatchObject({
        commitMessageMarker: true,
        dispatchInputRequested: true,
        repositoryVariableRequested: true,
      })
      expect(decision.operatorIntent?.note).toContain('grants no authorization')
    })

    it('still blocks the ungated case even though every intent signal is present', () => {
      const decision = evaluateReleaseAuthorization(
        {
          ...RUN_ENV,
          AUTHORIZE_PRODUCTION_RELEASE: 'true',
          SOPHIA_RELEASE_AUTHORIZED: '1',
          COMMIT_MESSAGE: '[RELEASE-AUTHORIZED]',
        },
        enforcedGate({ requiresIndependentReview: false, reviewerCount: 0 })
      )
      expect(decision.authorized).toBe(false)
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_NO_INDEPENDENT_REVIEWER')
    })
  })

  describe('missing or unverifiable gate evidence fails closed', () => {
    it('rejects when no evidence was supplied at all', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV }, null)
      expect(decision.authorized).toBe(false)
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_UNVERIFIED')
    })

    it('rejects when the evidence could not be collected', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV }, enforcedGate({ checked: false }))
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_UNVERIFIED')
    })
  })

  describe('binding checks', () => {
    it('rejects a gate verified for a different environment', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV }, enforcedGate({ environment: 'staging' }))
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_ENVIRONMENT_MISMATCH')
    })

    it('rejects a gate belonging to another repository', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV }, enforcedGate({ repository: 'someone/else' }))
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_REPOSITORY_MISMATCH')
    })

    it('rejects a gate belonging to a different workflow run', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV }, enforcedGate({ runId: '999' }))
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_RUN_MISMATCH')
    })

    it('rejects when the run exposes no workflow run id', () => {
      const { GITHUB_RUN_ID: _omitted, ...withoutRunId } = RUN_ENV
      const decision = evaluateReleaseAuthorization(withoutRunId, enforcedGate())
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_RUN_MISSING')
    })

    it('rejects when the run exposes no head commit SHA', () => {
      const { GITHUB_SHA: _omitted, ...withoutSha } = RUN_ENV
      const decision = evaluateReleaseAuthorization(withoutSha, enforcedGate())
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_REVISION_MISSING')
    })

    it('rejects a gate belonging to a different run attempt', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV }, enforcedGate({ runAttempt: '2' }))
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_ATTEMPT_MISMATCH')
    })

    it('rejects a gate collected for a different commit', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV }, enforcedGate({ sha: '0'.repeat(40) }))
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_REVISION_MISMATCH')
    })
  })

  describe('the gate must be one GitHub actually enforces', () => {
    it('rejects the current live configuration: no required reviewers', () => {
      const decision = evaluateReleaseAuthorization(
        { ...RUN_ENV },
        enforcedGate({ requiresIndependentReview: false, reviewerCount: 0 })
      )
      expect(decision.authorized).toBe(false)
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_NO_INDEPENDENT_REVIEWER')
    })

    it('rejects a reviewer rule listing zero reviewers', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV }, enforcedGate({ reviewerCount: 0 }))
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_NO_INDEPENDENT_REVIEWER')
    })

    it('rejects a gate that allows approving your own run', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV }, enforcedGate({ preventSelfReview: false }))
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_SELF_REVIEW_ALLOWED')
    })

    it('rejects a gate admins may bypass', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV }, enforcedGate({ adminBypass: true }))
      expect(decision.mode).toBe('BLOCKED_RELEASE_GATE_ADMIN_BYPASS')
    })
  })

  describe('accepted path', () => {
    it('authorizes only a live-verified, independently reviewed, revision-bound gate', () => {
      const decision = evaluateReleaseAuthorization({ ...RUN_ENV }, enforcedGate())
      expect(decision.authorized).toBe(true)
      expect(decision.mode).toBe('ENVIRONMENT_APPROVAL_BOUND')
      expect(decision.reason).toContain(RELEASE_ENVIRONMENT)
      expect(decision.reason).toContain(RUN_ENV.GITHUB_RUN_ID)
      expect(decision.reason).toContain(RUN_ENV.GITHUB_SHA)
    })
  })

  describe('evidence parsing', () => {
    it('returns null for missing, empty, and malformed payloads', () => {
      expect(parseReleaseGateEvidence(undefined)).toBeNull()
      expect(parseReleaseGateEvidence('')).toBeNull()
      expect(parseReleaseGateEvidence('not json')).toBeNull()
      expect(parseReleaseGateEvidence('[1,2,3]')).toBeNull()
      expect(parseReleaseGateEvidence('"a string"')).toBeNull()
    })

    it('fails closed when the payload lacks the checked flag', () => {
      const gate = parseReleaseGateEvidence('{"environment":"production"}')
      expect(gate?.checked).toBe(false)
      expect(evaluateReleaseAuthorization({ ...RUN_ENV }, gate).mode).toBe(
        'BLOCKED_RELEASE_GATE_UNVERIFIED'
      )
    })

    it('round-trips an enforced gate payload', () => {
      const gate = parseReleaseGateEvidence(JSON.stringify(enforcedGate() as unknown))
      expect(gate).not.toBeNull()
      expect(evaluateReleaseAuthorization({ ...RUN_ENV }, gate).authorized).toBe(true)
    })
  })
})
