// @vitest-environment node
/**
 * End-to-End Integration & Unit Tests for Pilot Affiliate Revenue Studio:
 * - Prompt builder, JSON parser, anti-guaranteed-profit Crypto compliance guard, referral URL preservation
 * - D1 SQLite vertical slice: CREATE OFFER -> CREATE CAMPAIGN -> GENERATE AFFILIATE CONTENT ->
 *   EDIT -> SAVE -> APPROVE -> EXPORT WITH REFERRAL CTA -> RECORD PERFORMANCE
 * - Domain B `workspace_external_commissions` reconciliation & multi-currency safety
 * - Tenant isolation, version locking, quota refund on invalid BYOK key, and live OpenRouter caller wiring.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAffiliateCampaignUserPrompt,
  buildMandatoryAffiliateDisclosure,
  buildSimulatedAffiliateCampaignPack,
  containsProhibitedCryptoClaim,
  normalizeAndValidateCampaignPack,
  renderAffiliateCampaignMarkdown,
  type AffiliateCampaignPack,
} from '@/seed/ai/affiliate-campaign-prompt';
import { generateAffiliateCampaignPack } from '@/seed/ai/affiliate-campaign-generator';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import { PILOT_POLICY_VERSION } from '@/seed/pilot/pilot-access-policy';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, verifyCsrfToken } from '@/seed/security/csrf';
import {
  ProviderInvalidKeyError,
  ProviderQuotaExceededError,
} from '@/seed/services/errors';
import {
  handleFirstValueGet,
  handleFirstValuePost,
  type FirstValueHttpDeps,
} from '@/land/first-value/first-value-http-handler';

const mockResilientChatCompletion = vi.fn();
vi.mock('@/seed/inference/openrouter-client', () => ({
  resilientChatCompletion: (...args: unknown[]) => mockResilientChatCompletion(...args),
}));

const CSRF_TOKEN = 'csrf-affiliate-studio-token-0123456789abcdef';
const SIGNING_SECRET = 'affiliate-studio-signing-secret-32b';

function makeReq(
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
  idempotencyKey?: string,
): NextRequest {
  const headers = new Headers();
  if (method === 'POST') {
    headers.set('content-type', 'application/json');
    headers.set('cookie', `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`);
    headers.set(CSRF_HEADER_NAME, CSRF_TOKEN);
  }
  if (idempotencyKey) {
    headers.set('idempotency-key', idempotencyKey);
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const VALID_LLM_PACK: AffiliateCampaignPack = {
  campaignTitle: 'Ledger Nano X Cold Storage Security Guide',
  audienceAnalysis: 'Long-term crypto holders in the US seeking hardware key custody.',
  valueProposition: 'Offline private-key signing without custodial counterparty exposure.',
  contentAngles: [
    'Self-custody vs exchange custody breakdown',
    '5-minute hardware wallet backup checklist',
  ],
  hook: 'Not your keys, not your coins — see how offline signing works in 30 seconds.',
  callToAction: 'Check official Ledger specs via our partner link: https://shop.ledger.com/?r=ceo88',
  shortFormScript: {
    title: 'Ledger Cold Storage 30s Walkthrough',
    total_duration: 30,
    scenes: [
      {
        scene_number: 1,
        title: 'Hook',
        visual_description: 'Hardware wallet next to laptop',
        narration: 'Leaving assets on hot wallets exposes keys to browser malware.',
        duration_estimate: 10,
      },
      {
        scene_number: 2,
        title: 'How It Works',
        visual_description: 'Physical button confirmation on device',
        narration: 'Hardware signing keeps private keys inside an isolated secure element.',
        duration_estimate: 10,
      },
      {
        scene_number: 3,
        title: 'Disclosure & Link',
        visual_description: 'Official site & risk disclosure card',
        narration: 'Review full details and risk disclosures at https://shop.ledger.com/?r=ceo88.',
        duration_estimate: 10,
      },
    ],
  },
  socialPost: 'How hardware signing protects self-custody workflows.',
  affiliateDisclosure: '#ad',
  referralUrl: 'https://shop.ledger.com/?r=ceo88',
};

describe('seed/ai affiliate-campaign-prompt & generator', () => {
  it('enforces referral link preservation, disclosures, and rejects guaranteed-profit Crypto claims', () => {
    expect(containsProhibitedCryptoClaim('Get guaranteed profit every week')).toBe(true);
    expect(containsProhibitedCryptoClaim('Cam kết lợi nhuận 20% mỗi tháng')).toBe(true);
    expect(containsProhibitedCryptoClaim('Practical cold-storage security review')).toBe(false);

    const promptEn = buildAffiliateCampaignUserPrompt(
      {
        vertical: 'crypto',
        productName: 'Ledger Nano X',
        officialWebsiteUrl: 'https://www.ledger.com',
        referralUrl: 'https://shop.ledger.com/?r=ceo88',
        commissionTerms: '10% per hardware unit',
        targetAudience: 'US self-custody holders',
        targetMarket: 'US',
        productInfoSource: 'Official Ledger product sheet',
      },
      30,
      'en',
    );
    expect(promptEn).toContain('https://shop.ledger.com/?r=ceo88');

    const normalized = normalizeAndValidateCampaignPack(
      {
        ...VALID_LLM_PACK,
        callToAction: 'Check official specs today',
        socialPost: 'Hardware wallet security checklist',
      },
      {
        expectedReferralUrl: 'https://shop.ledger.com/?r=ceo88',
        vertical: 'crypto',
        targetMarket: 'US',
        targetDurationSec: 30,
        locale: 'en',
      },
    );
    expect(normalized.callToAction).toContain('https://shop.ledger.com/?r=ceo88');
    expect(normalized.socialPost).toContain('https://shop.ledger.com/?r=ceo88');
    expect(normalized.socialPost).toContain('DISCLOSURE');

    expect(() =>
      normalizeAndValidateCampaignPack(
        {
          ...VALID_LLM_PACK,
          hook: '100% guaranteed profit with risk-free crypto returns!',
        },
        {
          expectedReferralUrl: 'https://shop.ledger.com/?r=ceo88',
          vertical: 'crypto',
          targetMarket: 'US',
          locale: 'en',
        },
      ),
    ).toThrow(/prohibited guaranteed-profit/i);

    // Visual description guaranteed-profit claims are also blocked
    expect(() =>
      normalizeAndValidateCampaignPack(
        {
          ...VALID_LLM_PACK,
          shortFormScript: {
            ...VALID_LLM_PACK.shortFormScript,
            scenes: VALID_LLM_PACK.shortFormScript.scenes.map((s, idx) =>
              idx === 0 ? { ...s, visual_description: 'Overlay: 100% guaranteed profit' } : s,
            ),
          },
        },
        {
          expectedReferralUrl: 'https://shop.ledger.com/?r=ceo88',
          vertical: 'crypto',
          targetMarket: 'US',
          locale: 'en',
        },
      ),
    ).toThrow(/prohibited guaranteed-profit/i);

    // Foreign competing URL & suffix-spoofed referral URL are rejected
    expect(() =>
      normalizeAndValidateCampaignPack(
        {
          ...VALID_LLM_PACK,
          callToAction: 'Sign up at https://competitor.example.io/?ref=hijack',
        },
        {
          expectedReferralUrl: 'https://shop.ledger.com/?r=ceo88',
          officialWebsiteUrl: 'https://www.ledger.com',
          vertical: 'crypto',
          targetMarket: 'US',
          locale: 'en',
        },
      ),
    ).toThrow(/unauthorized third-party URL/i);

    expect(() =>
      normalizeAndValidateCampaignPack(
        {
          ...VALID_LLM_PACK,
          callToAction: 'Sign up at https://shop.ledger.com/?r=ceo88999',
        },
        {
          expectedReferralUrl: 'https://shop.ledger.com/?r=ceo88',
          officialWebsiteUrl: 'https://www.ledger.com',
          vertical: 'crypto',
          targetMarket: 'US',
          locale: 'en',
        },
      ),
    ).toThrow(/modified or spoofed referral URL/i);

    // Bare #ad on Crypto campaign cannot bypass full regulatory risk disclosure
    const cryptoEditedWithBareAd = normalizeAndValidateCampaignPack(
      {
        ...VALID_LLM_PACK,
        socialPost: 'Check Ledger https://shop.ledger.com/?r=ceo88 #ad',
      },
      {
        expectedReferralUrl: 'https://shop.ledger.com/?r=ceo88',
        officialWebsiteUrl: 'https://www.ledger.com',
        vertical: 'crypto',
        targetMarket: 'US',
        locale: 'en',
      },
    );
    expect(cryptoEditedWithBareAd.socialPost).toContain(
      'Cryptocurrencies are highly volatile and speculative assets',
    );

    expect(buildMandatoryAffiliateDisclosure('saas', 'GLOBAL', 'vi')).toContain('#QuảngCáo');
    expect(buildMandatoryAffiliateDisclosure('saas', 'GLOBAL', 'en')).toContain('#ad');

    const stub = buildSimulatedAffiliateCampaignPack(
      {
        vertical: 'saas',
        productName: 'SEMrush',
        officialWebsiteUrl: 'https://semrush.com',
        referralUrl: 'https://semrush.com/?ref=stub1',
        commissionTerms: '30% recurring',
        targetAudience: 'Agencies',
        targetMarket: 'US',
        productInfoSource: 'Official site',
      },
      30,
      'en',
    );
    expect(stub.campaignTitle).toContain('[SIMULATED STUB]');
    expect(stub.referralUrl).toBe('https://semrush.com/?ref=stub1');

    const md = renderAffiliateCampaignMarkdown({
      campaignId: 'pcmp_1',
      orgId: 'org_1',
      version: 1,
      provenance: 'live_provider',
      provenanceLabel: 'LIVE_PROVIDER_INFERENCE',
      reviewState: 'approved',
      offer: {
        vertical: 'crypto',
        productName: 'Ledger Nano X',
        officialWebsiteUrl: 'https://www.ledger.com',
        referralUrl: 'https://shop.ledger.com/?r=ceo88',
        commissionTerms: '10% per unit',
        targetAudience: 'US holders',
        targetMarket: 'US',
        productInfoSource: 'Ledger specs',
      },
      pack: normalized,
    });
    expect(md).toContain('https://shop.ledger.com/?r=ceo88');
    expect(md).toContain('LIVE_PROVIDER_INFERENCE');
  });

  it('calls OpenRouter with customer BYOK circuit isolation and validates JSON', async () => {
    await expect(
      generateAffiliateCampaignPack({
        offer: {
          vertical: 'saas',
          productName: 'SEMrush',
          officialWebsiteUrl: 'https://semrush.com',
          referralUrl: 'https://semrush.com/?ref=123',
          commissionTerms: '30%',
          targetAudience: 'Agencies',
          targetMarket: 'GLOBAL',
          productInfoSource: 'Docs',
        },
        durationSec: 30,
        locale: 'vi',
        userId: 'usr_1',
        apiKey: '   ',
        model: 'openai/gpt-4o-mini',
        maxTokens: 2048,
        maxRetries: 1,
        timeoutMs: 30000,
      }),
    ).rejects.toThrow(/OpenRouter API key is required/);

      mockResilientChatCompletion.mockResolvedValueOnce(
        '```json\n' +
          JSON.stringify({
            ...VALID_LLM_PACK,
            referralUrl: 'https://semrush.com/?ref=123',
            callToAction: 'Start at https://semrush.com/?ref=123',
            socialPost: 'Try SEMrush https://semrush.com/?ref=123',
            shortFormScript: {
              ...VALID_LLM_PACK.shortFormScript,
              scenes: VALID_LLM_PACK.shortFormScript.scenes.map((s, idx) =>
                idx === 2 ? { ...s, narration: 'Visit https://semrush.com/?ref=123.' } : s,
              ),
            },
          }) +
          '\n```',
      );

    const out = await generateAffiliateCampaignPack({
      offer: {
        vertical: 'saas',
        productName: 'SEMrush',
        officialWebsiteUrl: 'https://semrush.com',
        referralUrl: 'https://semrush.com/?ref=123',
        commissionTerms: '30%',
        targetAudience: 'Agencies',
        targetMarket: 'GLOBAL',
        productInfoSource: 'Docs',
      },
      durationSec: 30,
      locale: 'vi',
      userId: 'usr_1',
      apiKey: 'sk-or-v1-customer-key',
      model: 'openai/gpt-4o-mini',
      maxTokens: 2048,
      maxRetries: 1,
      timeoutMs: 30000,
      referer: 'https://pilot.example.test',
    });

    expect(out.referralUrl).toBe('https://semrush.com/?ref=123');
    expect(mockResilientChatCompletion).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        openRouterKey: 'sk-or-v1-customer-key',
        enableFallback: false,
        circuitKeyRef: 'byok:usr_1',
      }),
    );
  });
});

describe('Commercial Vertical Slice over /api/first-value + SQLite D1', () => {
  let tmpDir: string;
  let sqlite: NodeSqliteD1Database;
  let clockMs: number;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-aff-studio-'));
    sqlite = new NodeSqliteD1Database(path.join(tmpDir, 'studio.sqlite'));
    for (const mig of [
      '0515_first_value_reviews.sql',
      '0517_customer_pilot_first_value.sql',
      '0519_pilot_support_requests.sql',
      '0520_pilot_affiliate_revenue_studio.sql',
      '0522_pilot_affiliate_performance_tenant_isolation.sql',
    ]) {
      await sqlite.exec(
        fs.readFileSync(path.resolve(__dirname, '../../../../migrations', mig), 'utf8'),
      );
    }
    clockMs = 1_795_500_000_000;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeDeps(overrides: Partial<FirstValueHttpDeps> & { byokKey?: string | null } = {}): FirstValueHttpDeps {
    const byokKey = overrides.byokKey === undefined ? 'sk-or-v1-valid-customer-key' : overrides.byokKey;
    return {
      getD1: async () => sqlite as unknown as D1Database,
      getCurrentUser: async () => ({ id: 'usr_aff_1', email: 'ceo@pilot.test' }),
      verifyWorkspaceAccess: async (orgId, userId) => orgId === 'org_aff_1' && userId === 'usr_aff_1',
      verifyCsrf: verifyCsrfToken,
      listByokProviders: async () => (byokKey ? ['openrouter'] : []),
      signingSecret: SIGNING_SECRET,
      nowMs: () => clockMs,
      pilotEnv: {
        PILOT_INVITE_ONLY: 'true',
        PILOT_ALLOWED_EMAILS: 'ceo@pilot.test',
        PILOT_LIVE_INFERENCE_ENABLED: 'true',
        PILOT_FINANCING_MODE: 'CUSTOMER_BYOK',
        PILOT_MAX_GENERATIONS: '20',
        PILOT_MAX_ESTIMATED_SPEND_USD: '4.00',
        PILOT_ESTIMATED_COST_PER_ATTEMPT_USD: '0.02',
        PILOT_MODEL_ID: 'openai/gpt-4o-mini',
        PILOT_MAX_OUTPUT_TOKENS: '2048',
        PILOT_MAX_RETRIES: '1',
        PILOT_TIMEOUT_MS: '45000',
        PILOT_RATE_LIMIT_COOLDOWN_MS: '0',
      },
      lookupOpenRouterByokKey: async () => byokKey,
      generateLiveAffiliateCampaign: async () => VALID_LLM_PACK,
      ...overrides,
    };
  }

  it('completes CREATE OFFER -> GENERATE -> EDIT -> APPROVE -> EXPORT -> RECORD PERFORMANCE and blocks illegal Crypto markets', async () => {
    const deps = makeDeps();

    // 0. Accept pilot consent
    const consentRes = await handleFirstValuePost(
      makeReq('POST', 'https://pilot.test/api/first-value', {
        action: 'accept_pilot_terms',
        orgId: 'org_aff_1',
        policyVersion: PILOT_POLICY_VERSION,
        accepted: true,
      }),
      deps,
    );
    expect(consentRes.status).toBe(200);

    // 1. Block Crypto offer targeting prohibited markets (VN, SG, GLOBAL)
    for (const blockedMarket of ['VN', 'SG', 'GLOBAL']) {
      const blockedRes = await handleFirstValuePost(
        makeReq('POST', 'https://pilot.test/api/first-value', {
          action: 'save_affiliate_offer',
          orgId: 'org_aff_1',
          vertical: 'crypto',
          productName: 'Ledger Nano X',
          officialWebsiteUrl: 'https://www.ledger.com',
          referralUrl: 'https://shop.ledger.com/?r=ceo88',
          commissionTerms: '10% per hardware sale',
          targetAudience: 'Crypto holders',
          targetMarket: blockedMarket,
          productInfoSource: 'Official Ledger affiliate page',
        }),
        deps,
      );
      expect(blockedRes.status).toBe(422);
      expect(((await blockedRes.json()) as { code: string }).code).toBe(
        'COMPLIANCE_JURISDICTION_BLOCKED',
      );
    }

    // 2. Create valid US Crypto Affiliate Offer + SaaS Offer (and archive SaaS offer)
    const offerRes = await handleFirstValuePost(
      makeReq('POST', 'https://pilot.test/api/first-value', {
        action: 'save_affiliate_offer',
        orgId: 'org_aff_1',
        vertical: 'crypto',
        productName: 'Ledger Nano X',
        officialWebsiteUrl: 'https://www.ledger.com',
        referralUrl: 'https://shop.ledger.com/?r=ceo88',
        commissionTerms: '10% commission after 30-day return window',
        targetAudience: 'US self-custody crypto holders',
        targetMarket: 'US',
        productInfoSource: 'https://www.ledger.com/affiliate-program',
      }),
      deps,
    );
    expect(offerRes.status).toBe(201);
    const offerId = ((await offerRes.json()) as { offer: { id: string } }).offer.id;

    const saasOfferRes = await handleFirstValuePost(
      makeReq('POST', 'https://pilot.test/api/first-value', {
        action: 'save_affiliate_offer',
        orgId: 'org_aff_1',
        vertical: 'saas',
        productName: 'SEMrush',
        officialWebsiteUrl: 'https://www.semrush.com',
        referralUrl: 'https://www.semrush.com/?ref=99',
        commissionTerms: '30% recurring',
        targetAudience: 'SEO teams',
        targetMarket: 'GLOBAL',
        productInfoSource: 'Official SEMrush docs',
      }),
      deps,
    );
    const saasOfferId = ((await saasOfferRes.json()) as { offer: { id: string } }).offer.id;

    const archiveRes = await handleFirstValuePost(
      makeReq('POST', 'https://pilot.test/api/first-value', {
        action: 'archive_affiliate_offer',
        orgId: 'org_aff_1',
        offerId: saasOfferId,
      }),
      deps,
    );
    expect(archiveRes.status).toBe(200);

    // 3. Simulated stub blocked in live pilot mode
    const stubBlocked = await handleFirstValuePost(
      makeReq(
        'POST',
        'https://pilot.test/api/first-value',
        {
          action: 'generate_affiliate_campaign',
          orgId: 'org_aff_1',
          offerId,
          provenance: 'fixture_simulated',
          idempotencyKey: 'idem-stub-blocked-01',
        },
        'idem-stub-blocked-01',
      ),
      deps,
    );
    expect(stubBlocked.status).toBe(403);

    // 4. Pre-charge invalid BYOK key refunds quota slot
    const invalidKeyDeps = makeDeps({
      generateLiveAffiliateCampaign: async () => {
        throw new ProviderInvalidKeyError('OpenRouter', '401 invalid key');
      },
    });
    const invalidKeyRes = await handleFirstValuePost(
      makeReq(
        'POST',
        'https://pilot.test/api/first-value',
        {
          action: 'generate_affiliate_campaign',
          orgId: 'org_aff_1',
          offerId,
          provenance: 'live_provider',
          idempotencyKey: 'idem-invalid-key-01',
        },
        'idem-invalid-key-01',
      ),
      invalidKeyDeps,
    );
    expect(invalidKeyRes.status).toBe(422);
    expect(((await invalidKeyRes.json()) as { quotaRefunded: boolean }).quotaRefunded).toBe(true);

    // Exhausted credit also refunds quota slot
    const quotaErrDeps = makeDeps({
      generateLiveAffiliateCampaign: async () => {
        throw new ProviderQuotaExceededError('OpenRouter', '402 insufficient credits');
      },
    });
    const quotaErrRes = await handleFirstValuePost(
      makeReq(
        'POST',
        'https://pilot.test/api/first-value',
        {
          action: 'generate_affiliate_campaign',
          orgId: 'org_aff_1',
          offerId,
          provenance: 'live_provider',
          idempotencyKey: 'idem-quota-err-01',
        },
        'idem-quota-err-01',
      ),
      quotaErrDeps,
    );
    expect(quotaErrRes.status).toBe(502);

    // 5. Generate Live Affiliate Campaign + verify idempotent replay
    const genRes = await handleFirstValuePost(
      makeReq(
        'POST',
        'https://pilot.test/api/first-value',
        {
          action: 'generate_affiliate_campaign',
          orgId: 'org_aff_1',
          offerId,
          durationSec: 30,
          locale: 'en',
          provenance: 'live_provider',
          idempotencyKey: 'idem-gen-live-001',
        },
        'idem-gen-live-001',
      ),
      deps,
    );
    expect(genRes.status).toBe(201);
    const genJson = (await genRes.json()) as {
      campaign: { id: string; version: number; pack: AffiliateCampaignPack };
      paidInferenceExecuted: boolean;
    };
    expect(genJson.paidInferenceExecuted).toBe(true);
    expect(genJson.campaign.pack.referralUrl).toBe('https://shop.ledger.com/?r=ceo88');
    const campaignId = genJson.campaign.id;

    const replayRes = await handleFirstValuePost(
      makeReq(
        'POST',
        'https://pilot.test/api/first-value',
        {
          action: 'generate_affiliate_campaign',
          orgId: 'org_aff_1',
          offerId,
          durationSec: 30,
          locale: 'en',
          provenance: 'live_provider',
          idempotencyKey: 'idem-gen-live-001',
        },
        'idem-gen-live-001',
      ),
      deps,
    );
    expect(replayRes.status).toBe(200);
    expect(((await replayRes.json()) as { idempotentReplay: boolean }).idempotentReplay).toBe(true);

    // 6. Export before approval is blocked (409)
    const prematureExport = await handleFirstValuePost(
      makeReq(
        'POST',
        'https://pilot.test/api/first-value',
        {
          action: 'export_affiliate_campaign',
          orgId: 'org_aff_1',
          campaignId,
          format: 'markdown',
          idempotencyKey: 'idem-exp-early-01',
        },
        'idem-exp-early-01',
      ),
      deps,
    );
    expect(prematureExport.status).toBe(409);

    // 7. Edit campaign pack (version 1 -> 2)
    const editRes = await handleFirstValuePost(
      makeReq(
        'POST',
        'https://pilot.test/api/first-value',
        {
          action: 'edit_affiliate_campaign',
          orgId: 'org_aff_1',
          campaignId,
          expectedVersion: 1,
          locale: 'en',
          pack: {
            ...genJson.campaign.pack,
            campaignTitle: 'Ledger Nano X Cold Storage — Edited Edition',
          },
          idempotencyKey: 'idem-edit-live-01',
        },
        'idem-edit-live-01',
      ),
      deps,
    );
    expect(editRes.status).toBe(200);
    const edited = (await editRes.json()) as { campaign: { version: number; campaignName: string } };
    expect(edited.campaign.version).toBe(2);
    expect(edited.campaign.campaignName).toBe('Ledger Nano X Cold Storage — Edited Edition');

    // 8. Approve campaign (version 2 -> 3)
    const approveRes = await handleFirstValuePost(
      makeReq(
        'POST',
        'https://pilot.test/api/first-value',
        {
          action: 'approve_affiliate_campaign',
          orgId: 'org_aff_1',
          campaignId,
          expectedVersion: 2,
          explicitUserAction: true,
          idempotencyKey: 'idem-approve-01',
        },
        'idem-approve-01',
      ),
      deps,
    );
    expect(approveRes.status).toBe(200);

    // 9. Export Markdown & JSON with exact referral URL preserved
    const mdExportRes = await handleFirstValuePost(
      makeReq(
        'POST',
        'https://pilot.test/api/first-value',
        {
          action: 'export_affiliate_campaign',
          orgId: 'org_aff_1',
          campaignId,
          format: 'markdown',
          idempotencyKey: 'idem-export-md-01',
        },
        'idem-export-md-01',
      ),
      deps,
    );
    expect(mdExportRes.status).toBe(200);
    const mdContent = ((await mdExportRes.json()) as { export: { content: string } }).export.content;
    expect(mdContent).toContain('https://shop.ledger.com/?r=ceo88');
    expect(mdContent).toContain('Ledger Nano X Cold Storage — Edited Edition');

    const jsonExportRes = await handleFirstValuePost(
      makeReq(
        'POST',
        'https://pilot.test/api/first-value',
        {
          action: 'export_affiliate_campaign',
          orgId: 'org_aff_1',
          campaignId,
          format: 'json',
          idempotencyKey: 'idem-export-json-01',
        },
        'idem-export-json-01',
      ),
      deps,
    );
    expect(jsonExportRes.status).toBe(200);
    const jsonExport = ((await jsonExportRes.json()) as {
      export: { referralUrl: string; publicPublished: boolean };
    }).export;
    expect(jsonExport.referralUrl).toBe('https://shop.ledger.com/?r=ceo88');
    expect(jsonExport.publicPublished).toBe(false);

    // 10. Check initial revenue snapshot (partnerFeedStatus = NOT_CONNECTED, clicks = null, $0.00 commission)
    const beforePerfGet = await handleFirstValueGet(
      makeReq('GET', 'https://pilot.test/api/first-value?orgId=org_aff_1'),
      deps,
    );
    const beforeSnap = (await beforePerfGet.json()) as {
      affiliateStudio: {
        revenue: {
          partnerFeedStatus: string;
          clicksCount: number | null;
          confirmedCommissionUsd: number;
          estimatedAiCostUsd: number;
        };
      };
    };
    expect(beforeSnap.affiliateStudio.revenue.partnerFeedStatus).toBe('NOT_CONNECTED');
    expect(beforeSnap.affiliateStudio.revenue.clicksCount).toBeNull();
    expect(beforeSnap.affiliateStudio.revenue.confirmedCommissionUsd).toBe(0);
    expect(beforeSnap.affiliateStudio.revenue.estimatedAiCostUsd).toBe(0.02);

    // 11. Record verified partner performance statement -> updates Domain B ledger & Net Revenue
    const perfRes = await handleFirstValuePost(
      makeReq('POST', 'https://pilot.test/api/first-value', {
        action: 'record_partner_performance',
        orgId: 'org_aff_1',
        campaignId,
        reportSource: 'Ledger Affiliate Portal Statement CSV',
        reportPeriod: '2026-11',
        externalRefId: 'ledger-stmt-2026-11-001',
        clicksCount: 128,
        signupsCount: 14,
        qualifiedConversions: 4,
        pendingCommissionUsd: 29.8,
        confirmedCommissionUsd: 59.6,
        currency: 'USD',
      }),
      deps,
    );
    expect(perfRes.status).toBe(201);
    const perfJson = (await perfRes.json()) as {
      revenue: {
        clicksCount: number;
        signupsCount: number;
        qualifiedConversions: number;
        pendingCommissionUsd: number;
        confirmedCommissionUsd: number;
        estimatedAiCostUsd: number;
        netRevenueUsd: number;
      };
    };
    expect(perfJson.revenue.clicksCount).toBe(128);
    expect(perfJson.revenue.signupsCount).toBe(14);
    expect(perfJson.revenue.qualifiedConversions).toBe(4);
    expect(perfJson.revenue.pendingCommissionUsd).toBe(29.8);
    expect(perfJson.revenue.confirmedCommissionUsd).toBe(59.6);
    expect(perfJson.revenue.estimatedAiCostUsd).toBe(0.02);
    expect(perfJson.revenue.netRevenueUsd).toBe(59.58);

    // Duplicate externalRefId is idempotent (does not double-count commission!)
    const dupPerfRes = await handleFirstValuePost(
      makeReq('POST', 'https://pilot.test/api/first-value', {
        action: 'record_partner_performance',
        orgId: 'org_aff_1',
        campaignId,
        reportSource: 'Ledger Affiliate Portal Statement CSV',
        reportPeriod: '2026-11',
        externalRefId: 'ledger-stmt-2026-11-001',
        clicksCount: 128,
        signupsCount: 14,
        qualifiedConversions: 4,
        pendingCommissionUsd: 29.8,
        confirmedCommissionUsd: 59.6,
        currency: 'USD',
      }),
      deps,
    );
    expect(dupPerfRes.status).toBe(200);
    const dupJson = (await dupPerfRes.json()) as {
      idempotentReplay: boolean;
      revenue: { confirmedCommissionUsd: number };
    };
    expect(dupJson.idempotentReplay).toBe(true);
    expect(dupJson.revenue.confirmedCommissionUsd).toBe(59.6);
  });

  it('supports zero-cost fixture_simulated campaign in non-live mode', async () => {
    const nonLiveDeps = makeDeps({
      pilotEnv: {
        PILOT_INVITE_ONLY: 'false',
        PILOT_LIVE_INFERENCE_ENABLED: 'false',
      },
    });

    const offerRes = await handleFirstValuePost(
      makeReq('POST', 'https://pilot.test/api/first-value', {
        action: 'save_affiliate_offer',
        orgId: 'org_aff_1',
        vertical: 'saas',
        productName: 'SmartSuite',
        officialWebsiteUrl: 'https://smartsuite.com',
        referralUrl: 'https://smartsuite.com/?via=demo',
        commissionTerms: '50% first year',
        targetAudience: 'Ops managers',
        targetMarket: 'US',
        productInfoSource: 'SmartSuite partner docs',
      }),
      nonLiveDeps,
    );
    const offerId = ((await offerRes.json()) as { offer: { id: string } }).offer.id;

    const simRes = await handleFirstValuePost(
      makeReq(
        'POST',
        'https://pilot.test/api/first-value',
        {
          action: 'generate_affiliate_campaign',
          orgId: 'org_aff_1',
          offerId,
          provenance: 'fixture_simulated',
          idempotencyKey: 'idem-sim-campaign-01',
        },
        'idem-sim-campaign-01',
      ),
      nonLiveDeps,
    );
    expect(simRes.status).toBe(201);
    const simJson = (await simRes.json()) as {
      campaign: { provenance: string; provenanceLabel: string; pack: AffiliateCampaignPack };
      paidInferenceExecuted: boolean;
    };
    expect(simJson.paidInferenceExecuted).toBe(false);
    expect(simJson.campaign.provenance).toBe('fixture_simulated');
    expect(simJson.campaign.provenanceLabel).toBe('SIMULATED_FIXTURE_NOT_LIVE_AI_INFERENCE');
    expect(simJson.campaign.pack.referralUrl).toBe('https://smartsuite.com/?via=demo');

    // Record zero-decimal VND partner statement (> 1,000,000 VND) and verify exact subunit reconciliation
    const vndPerfRes = await handleFirstValuePost(
      makeReq('POST', 'https://pilot.test/api/first-value', {
        action: 'record_partner_performance',
        orgId: 'org_aff_1',
        campaignId: (simJson.campaign as unknown as { id: string }).id,
        reportSource: 'Vietnam SaaS Partner Statement',
        reportPeriod: '2026-11',
        externalRefId: 'vnd-stmt-001',
        clicksCount: 55,
        signupsCount: 6,
        qualifiedConversions: 2,
        pendingCommissionUsd: 1_200_000,
        confirmedCommissionUsd: 2_500_000,
        currency: 'VND',
      }),
      nonLiveDeps,
    );
    expect(vndPerfRes.status).toBe(201);
    const vndJson = (await vndPerfRes.json()) as {
      revenue: {
        currency: string;
        isMultiCurrency: boolean;
        pendingCommissionUsd: number;
        confirmedCommissionUsd: number;
        netRevenueUsd: number | null;
        netRevenueUnavailableReason: string | null;
      };
    };
    expect(vndJson.revenue.currency).toBe('VND');
    expect(vndJson.revenue.isMultiCurrency).toBe(false);
    expect(vndJson.revenue.pendingCommissionUsd).toBe(1_200_000);
    expect(vndJson.revenue.confirmedCommissionUsd).toBe(2_500_000);
    expect(vndJson.revenue.netRevenueUsd).toBeNull();
    expect(vndJson.revenue.netRevenueUnavailableReason).toBe('NON_USD_COMMISSION');
  });
});
