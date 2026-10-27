/**
 * Unit Tests for Approval Payload SHA-256 Hash Primitive
 *
 * @module seed/security/__tests__/approval-payload-hash.test
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalizeApprovalPayload,
  computeApprovalPayloadHash,
  type CampaignApprovalPayload,
} from '../approval-payload-hash';

describe('approval-payload-hash', () => {
  const basePayload: CampaignApprovalPayload = {
    scriptBody: 'Educational comparison of hardware wallets and fee tiers.',
    affiliateTargetUrl: 'https://www.binance.com/en/activity/referral?ref=OPC123',
    jurisdiction: 'us',
    disclosureText: 'Ad / Paid Partnership. Crypto assets are volatile.',
    maxRenderCostCents: 25,
  };

  it('produces a deterministic 64-char hex SHA-256 digest', async () => {
    const hash1 = await computeApprovalPayloadHash(basePayload);
    const hash2 = await computeApprovalPayloadHash({
      ...basePayload,
      jurisdiction: ' US ',
      scriptBody: '  Educational comparison of hardware wallets and fee tiers. ',
    });

    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    expect(hash1).toBe(hash2);
  });

  it('changes digest when scriptBody, affiliateTargetUrl, jurisdiction, disclosure, or budget mutates', async () => {
    const original = await computeApprovalPayloadHash(basePayload);

    const mutatedScript = await computeApprovalPayloadHash({
      ...basePayload,
      scriptBody: 'Guaranteed 10x return!',
    });
    const mutatedUrl = await computeApprovalPayloadHash({
      ...basePayload,
      affiliateTargetUrl: 'https://attacker.example/ref',
    });
    const mutatedJurisdiction = await computeApprovalPayloadHash({
      ...basePayload,
      jurisdiction: 'VN',
    });
    const mutatedDisclosure = await computeApprovalPayloadHash({
      ...basePayload,
      disclosureText: '',
    });
    const mutatedCost = await computeApprovalPayloadHash({
      ...basePayload,
      maxRenderCostCents: 500,
    });

    expect(mutatedScript).not.toBe(original);
    expect(mutatedUrl).not.toBe(original);
    expect(mutatedJurisdiction).not.toBe(original);
    expect(mutatedDisclosure).not.toBe(original);
    expect(mutatedCost).not.toBe(original);
  });

  it('canonicalizes keys in alphabetical order and clamps negative cost to 0', () => {
    const json = canonicalizeApprovalPayload({
      ...basePayload,
      maxRenderCostCents: -10,
    });
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual([
      'affiliateTargetUrl',
      'disclosureText',
      'jurisdiction',
      'maxRenderCostCents',
      'scriptBody',
    ]);
    expect(parsed.maxRenderCostCents).toBe(0);
    expect(parsed.jurisdiction).toBe('US');
  });
});
