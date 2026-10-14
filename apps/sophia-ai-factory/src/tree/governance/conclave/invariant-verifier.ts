/**
 * @file invariant-verifier.ts
 * @layer tree/governance/conclave
 * @description Verifies constitutional invariants and immutable articles.
 */

import { createHash } from 'node:crypto';
import type { ConstitutionalInvariantItem, InvariantCheckResult } from './types';

export function verifyParameterizedConstitutionalInvariants(
  invariants: ConstitutionalInvariantItem[],
  proposedTargetArticleCode: string,
  actionCode?: string,
  config: { hashPrefix?: string; reasonPrefix?: string } = {}
): InvariantCheckResult {
  const match = invariants.find((inv) => inv.articleCode === proposedTargetArticleCode);

  if (!match) {
    const hash = createHash('sha256')
      .update(`INVARIANT_NOT_FOUND:${proposedTargetArticleCode}`)
      .digest('hex');
    return {
      allowed: true,
      articleCode: proposedTargetArticleCode,
      isStrictlyImmutable: false,
      reason:
        'Article not found in constitutional invariants charter; standard modification procedure applies',
      verificationHash: hash,
    };
  }

  const prefix = config.hashPrefix ?? 'CONSTITUTIONAL_INVARIANT';
  const hash = createHash('sha256')
    .update(
      `${prefix}:${match.articleCode}:${match.isStrictlyImmutable}:${match.enforcementCircuitHash ?? ''}`
    )
    .digest('hex');

  if (actionCode && match.isStrictlyImmutable && actionCode.includes('OVERRIDE')) {
    return {
      allowed: false,
      articleCode: match.articleCode,
      isStrictlyImmutable: true,
      reason: `Action ${actionCode} violates strictly immutable constitutional invariant ${match.articleCode}`,
      verificationHash: hash,
    };
  }

  if (match.isStrictlyImmutable) {
    return {
      allowed: false,
      articleCode: match.articleCode,
      isStrictlyImmutable: true,
      reason: `Violation of Constitutional Invariant ${match.articleCode} ("${match.articleTitle ?? ''}"): Strictly Immutable`,
      verificationHash: hash,
    };
  }

  return {
    allowed: true,
    articleCode: match.articleCode,
    isStrictlyImmutable: false,
    verificationHash: hash,
  };
}
