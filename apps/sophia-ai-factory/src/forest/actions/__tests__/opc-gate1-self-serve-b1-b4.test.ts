/**
 * Deterministic Self-Serve Pre-Flight Integration Suite (B1–B4 & S1–S3 at $0.00 Spend).
 *
 * Verifies that a customer/workspace owner can transition OPC Gate 1 readiness
 * from missing prerequisites (`configPresentForGate1 = false`) to `6/6 ✓`
 * (`configPresentForGate1 = true`, `gate1ReadyForLiveProof = true`) using only
 * the self-serve modules with 0 paid external calls, and enforces fail-closed
 * security invariants S1 (crypto_global jurisdiction), S2 (Zod validation),
 * and S3 (resolveOrgId DB error handling).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createOpcGate1StatefulMockD1,
  type MockChannelRow,
  type MockOfferRow,
} from './opc-gate1-mock-d1-helper';

const {
  mockGetCurrentUser,
  mockResolveOrgId,
  mockHasWorkspaceRole,
  mockListUserApiKeyProviders,
  mockGetD1,
  mockInngestSend,
  channelStore,
  offerStore,
  killSwitchPlatformConfig,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockResolveOrgId: vi.fn(),
  mockHasWorkspaceRole: vi.fn(),
  mockListUserApiKeyProviders: vi.fn(),
  mockGetD1: vi.fn(),
  mockInngestSend: vi.fn(),
  channelStore: new Map<string, MockChannelRow>(),
  offerStore: new Map<string, MockOfferRow>(),
  killSwitchPlatformConfig: new Map<string, string>(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock('@/seed/auth/resolve-org-id', () => ({ resolveOrgId: mockResolveOrgId }));
vi.mock('@/seed/auth/workspace-access', () => ({ hasWorkspaceRole: mockHasWorkspaceRole }));
vi.mock('@/tree/byok/user-api-key-store', () => ({
  listUserApiKeyProviders: mockListUserApiKeyProviders,
}));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1, createServerClient: vi.fn() }));
vi.mock('@/seed/inngest/client', () => ({ inngest: { send: mockInngestSend } }));
vi.mock('@/seed/db/platform-config-repo', () => ({
  getPlatformConfigStrict: vi.fn(async (key: string) => killSwitchPlatformConfig.get(key) ?? null),
  setPlatformConfig: vi.fn(async (key: string, val: string) => {
    killSwitchPlatformConfig.set(key, val);
    return true;
  }),
}));

import {
  KEY_TO_PROVIDER as CONST_KEY_TO_PROVIDER,
  INITIAL_CONFIG,
} from '@/tree/components/setup-wizard/steps/setup-wizard-constants';
import {
  KEY_TO_PROVIDER as HELPER_KEY_TO_PROVIDER,
  INITIAL_WIZARD_CONFIG,
} from '@/tree/components/setup-wizard/steps/use-setup-wizard-helpers';
import { registerPublishingChannel } from '@/land/publish/register-publishing-channel';
import { resetKillSwitchInMemoryCache } from '@/tree/affiliate/kill-switch/kill-switch-store';
import {
  getOpcGate1ReadinessAction,
  saveNicheWorkspaceOfferAction,
  setOpcWorkspaceKillSwitchAction,
} from '@/forest/actions/opc-readiness-actions';

describe('OPC Gate 1 Self-Serve Pre-Flight & Security Invariants (B1–B4 + S1–S3)', () => {
  const userId = 'usr_ceo_01';
  const workspaceId = 'org_workspace_01';

  beforeEach(() => {
    vi.clearAllMocks();
    channelStore.clear();
    offerStore.clear();
    killSwitchPlatformConfig.clear();
    resetKillSwitchInMemoryCache();
    process.env.OAUTH_TOKEN_ENC_KEY = 'b'.repeat(64);

    mockGetCurrentUser.mockResolvedValue({ id: userId, email: 'ceo@example.com' });
    mockResolveOrgId.mockResolvedValue(workspaceId);
    mockHasWorkspaceRole.mockResolvedValue(true);
    mockGetD1.mockResolvedValue(createOpcGate1StatefulMockD1(channelStore, offerStore));
  });

  afterEach(() => {
    delete process.env.OAUTH_TOKEN_ENC_KEY;
  });

  it('maps HEYGEN_API_KEY -> heygen in Setup Wizard constants and helpers (B2)', () => {
    expect(CONST_KEY_TO_PROVIDER.HEYGEN_API_KEY).toBe('heygen');
    expect(HELPER_KEY_TO_PROVIDER.HEYGEN_API_KEY).toBe('heygen');
    expect(INITIAL_CONFIG.HEYGEN_API_KEY).toBe('');
    expect(INITIAL_WIZARD_CONFIG.HEYGEN_API_KEY).toBe('');
  });

  it('enforces S1 (fail-closed GLOBAL on crypto_global), S2 (Zod validation), and S3 (resolveOrgId DB error)', async () => {
    // S1: Explicit GLOBAL on crypto_global must be rejected fail-closed
    const blockedCryptoRes = await saveNicheWorkspaceOfferAction({
      niche: 'crypto_global',
      productName: 'Binance Global',
      productUrl: 'https://accounts.binance.com/register',
      commissionTerms: '20% Spot & Futures Fee Rebate Share',
      jurisdiction: 'GLOBAL',
    });
    expect(blockedCryptoRes.success).toBe(false);
    expect(blockedCryptoRes.code).toBe('JURISDICTION_UNASSESSED_OR_BLOCKED');

    // S2: Invalid payload rejected at Zod boundary before DB/auth
    const badOfferRes = await saveNicheWorkspaceOfferAction({
      niche: 'saas_global',
      productName: '',
      productUrl: 'not-a-valid-url',
      commissionTerms: '',
    });
    expect(badOfferRes.success).toBe(false);
    expect(badOfferRes.code).toBe('VALIDATION_ERROR');

    // S3: resolveOrgId throwing DB error fails closed (never falls back to user.id)
    mockResolveOrgId.mockRejectedValueOnce(new Error('D1_QUERY_TIMEOUT'));
    const dbErrRes = await setOpcWorkspaceKillSwitchAction({ active: false });
    expect(dbErrRes.success).toBe(false);
    expect(dbErrRes.code).toBe('WORKSPACE_RESOLUTION_FAILED');
  });

  it('transitions from 1/6 (admin only) to 6/6 green via self-serve B1–B4 with 0 paid calls', async () => {
    killSwitchPlatformConfig.set(`affiliate_kill_switch_active:${workspaceId}`, 'true');
    mockListUserApiKeyProviders.mockResolvedValue([]);

    const initialRes = await getOpcGate1ReadinessAction();
    expect(initialRes.success).toBe(true);
    expect(initialRes.data?.configPresentForGate1).toBe(false);
    expect(initialRes.data?.blockers).toEqual([
      'KILL_SWITCH_ACTIVE_OR_UNKNOWN',
      'BYOK_VOICE_MISSING',
      'BYOK_VIDEO_MISSING',
      'YOUTUBE_CHANNEL_MISSING',
      'SAAS_OFFER_MISSING',
      'CRYPTO_OFFER_MISSING',
    ]);

    mockListUserApiKeyProviders.mockResolvedValue([
      CONST_KEY_TO_PROVIDER.ELEVENLABS_API_KEY,
      CONST_KEY_TO_PROVIDER.HEYGEN_API_KEY,
    ]);

    const chResult = await registerPublishingChannel({
      userId,
      tenantId: workspaceId,
      provider: 'youtube',
      externalAccountId: 'UC_CEO_CHANNEL_99',
      accessToken: 'ya29.customer_byok_oauth_token',
      displayName: 'CEO Official Channel',
    });
    expect(chResult.status).toBe('active');
    expect(channelStore.get(chResult.channelId)?.tenant_id).toBe(workspaceId);

    const saasOfferRes = await saveNicheWorkspaceOfferAction({
      niche: 'saas_global',
      productName: 'Linear App',
      productUrl: 'https://linear.app',
      commissionTerms: '30% Recurring MRR for 12 months (PartnerStack)',
      jurisdiction: 'GLOBAL',
    });
    expect(saasOfferRes.success).toBe(true);
    expect(saasOfferRes.data?.report.eligibleSaasOfferIds.length).toBe(1);

    // Omitting jurisdiction on crypto_global defaults to assessed market 'US'
    const cryptoOfferRes = await saveNicheWorkspaceOfferAction({
      niche: 'crypto_global',
      productName: 'Binance US',
      productUrl: 'https://accounts.binance.us/register',
      commissionTerms: '20% Spot & Futures Fee Rebate Share',
    });
    expect(cryptoOfferRes.success).toBe(true);
    expect(cryptoOfferRes.data?.jurisdiction).toBe('US');
    expect(cryptoOfferRes.data?.report.eligibleCryptoOfferIds.length).toBe(1);

    const unlockRes = await setOpcWorkspaceKillSwitchAction({ active: false });
    expect(unlockRes.success).toBe(true);
    expect(unlockRes.data?.configPresentForGate1).toBe(true);
    expect(unlockRes.data?.gate1ReadyForLiveProof).toBe(true);
    expect(unlockRes.data?.blockers).toEqual([]);
    expect(unlockRes.data?.readinessCheckCostCents).toBe(0);
    expect(mockInngestSend).not.toHaveBeenCalled();
  });
});
