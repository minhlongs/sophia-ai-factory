/**
 * Deterministic Self-Serve Pre-Flight Integration Suite (B1–B4 at $0.00 Spend).
 *
 * Verifies that a customer/workspace owner can transition OPC Gate 1 readiness
 * from missing prerequisites (`configPresentForGate1 = false`) to `6/6 ✓`
 * (`configPresentForGate1 = true`, `gate1ReadyForLiveProof = true`) using only
 * the self-serve modules (`B1` registerPublishingChannel with workspaceId,
 * `B2` Setup Wizard KEY_TO_PROVIDER including HeyGen, `B3` saveNicheWorkspaceOfferAction,
 * and `B4` setOpcWorkspaceKillSwitchAction) with 0 paid external calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
} = vi.hoisted(() => {
  const channels = new Map<string, { id: string; tenant_id: string; user_id: string; provider: string; external_account_id: string; access_token: string; status: string; created_at: number }>();
  const offers = new Map<string, { id: string; tenant_id: string; network_id: string; external_id: string; product_url: string; destination_url: string; status: string; commission_terms: string; niche: string; region: string; category: string }>();
  const ksConfig = new Map<string, string>();
  return {
    mockGetCurrentUser: vi.fn(),
    mockResolveOrgId: vi.fn(),
    mockHasWorkspaceRole: vi.fn(),
    mockListUserApiKeyProviders: vi.fn(),
    mockGetD1: vi.fn(),
    mockInngestSend: vi.fn(),
    channelStore: channels,
    offerStore: offers,
    killSwitchPlatformConfig: ksConfig,
  };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/auth/resolve-org-id', () => ({
  resolveOrgId: mockResolveOrgId,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  hasWorkspaceRole: mockHasWorkspaceRole,
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  listUserApiKeyProviders: mockListUserApiKeyProviders,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mockGetD1,
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: mockInngestSend },
}));

vi.mock('@/seed/db/platform-config-repo', () => ({
  getPlatformConfig: vi.fn(async (key: string) => killSwitchPlatformConfig.get(key) ?? null),
  setPlatformConfig: vi.fn(async (key: string, val: string) => {
    killSwitchPlatformConfig.set(key, val);
  }),
}));

import { KEY_TO_PROVIDER as CONST_KEY_TO_PROVIDER, INITIAL_CONFIG } from '@/tree/components/setup-wizard/steps/setup-wizard-constants';
import { KEY_TO_PROVIDER as HELPER_KEY_TO_PROVIDER, INITIAL_WIZARD_CONFIG } from '@/tree/components/setup-wizard/steps/use-setup-wizard-helpers';
import { registerPublishingChannel } from '@/land/publish/register-publishing-channel';
import { resetKillSwitchInMemoryCache } from '@/tree/affiliate/kill-switch/kill-switch-store';
import {
  getOpcGate1ReadinessAction,
  saveNicheWorkspaceOfferAction,
  setOpcWorkspaceKillSwitchAction,
} from '@/forest/actions/opc-readiness-actions';

function createStatefulMockD1(): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('FROM publishing_channels') && sql.includes('external_account_id')) {
                const [tenantId, provider, extId] = args as [string, string, string];
                for (const row of channelStore.values()) {
                  if (row.tenant_id === tenantId && row.provider === provider && row.external_account_id === extId) {
                    return { id: row.id } as unknown as T;
                  }
                }
                return null;
              }
              if (sql.includes('FROM publishing_channels') && sql.includes('ORDER BY created_at DESC')) {
                const [tenantId] = args as [string];
                for (const row of channelStore.values()) {
                  if (row.tenant_id === tenantId && row.provider === 'youtube' && row.status === 'active') {
                    return { id: row.id, access_token: row.access_token } as unknown as T;
                  }
                }
                return null;
              }
              if (sql.includes('SELECT tenant_id FROM affiliate_offers WHERE id = ?')) {
                const [offerId] = args as [string];
                const found = offerStore.get(offerId);
                return (found ? { tenant_id: found.tenant_id } : null) as unknown as T;
              }
              return null;
            },
            async all<T>() {
              if (sql.includes('FROM affiliate_offers')) {
                const [workspaceId] = args as [string];
                const results = Array.from(offerStore.values()).filter(
                  (r) => (r.tenant_id === workspaceId || r.tenant_id === 'system') && r.status === 'active',
                );
                return { results: results as unknown as T[] };
              }
              return { results: [] as T[] };
            },
            async run() {
              if (sql.includes('INSERT INTO publishing_channels')) {
                const [id, tenantId, provider, extId, , accessToken, , , nowSec, userId] = args as [
                  string, string, string, string, string | null, string, string | null, number | null, number, string,
                ];
                channelStore.set(id, {
                  id,
                  tenant_id: tenantId,
                  user_id: userId,
                  provider,
                  external_account_id: extId,
                  access_token: accessToken,
                  status: 'active',
                  created_at: nowSec,
                });
              }
              if (sql.includes('INSERT INTO affiliate_offers')) {
                const [id, tenantId, networkId, externalId, , , category, productUrl, destinationUrl, commissionTerms, niche, region] =
                  args as [string, string, string, string, string, string, string, string, string, string, string, string];
                offerStore.set(id, {
                  id,
                  tenant_id: tenantId,
                  network_id: networkId,
                  external_id: externalId,
                  product_url: productUrl,
                  destination_url: destinationUrl,
                  status: 'active',
                  commission_terms: commissionTerms,
                  niche,
                  region,
                  category,
                });
              }
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe('OPC Gate 1 Self-Serve Pre-Flight Progression (B1–B4 at $0.00)', () => {
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
    mockGetD1.mockResolvedValue(createStatefulMockD1());
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

  it('transitions from 1/6 (admin only) to 6/6 green via self-serve B1–B4 with 0 paid calls', async () => {
    // Initial state: Kill Switch active, no BYOK keys, no YouTube channel, no offers
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

    // Step B2: Customer enters ElevenLabs + HeyGen BYOK keys in Setup Wizard
    mockListUserApiKeyProviders.mockResolvedValue([
      CONST_KEY_TO_PROVIDER.ELEVENLABS_API_KEY,
      CONST_KEY_TO_PROVIDER.HEYGEN_API_KEY,
    ]);

    // Step B1: Customer registers YouTube channel scoped to workspaceId (not raw userId)
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
    expect(channelStore.get(chResult.channelId)?.user_id).toBe(userId);

    // Step B3: Customer saves & verifies 1 SaaS offer and 1 Crypto offer at $0.00
    const saasOfferRes = await saveNicheWorkspaceOfferAction({
      niche: 'saas_global',
      productName: 'Linear App',
      productUrl: 'https://linear.app',
      commissionTerms: '30% Recurring MRR for 12 months (PartnerStack)',
      jurisdiction: 'GLOBAL',
    });
    expect(saasOfferRes.success).toBe(true);
    expect(saasOfferRes.data?.report.eligibleSaasOfferIds.length).toBe(1);

    // Even if UI sends GLOBAL on crypto_global, action normalizes to US so compliance passes
    const cryptoOfferRes = await saveNicheWorkspaceOfferAction({
      niche: 'crypto_global',
      productName: 'Binance Global',
      productUrl: 'https://accounts.binance.com/register',
      commissionTerms: '20% Spot & Futures Fee Rebate Share',
      jurisdiction: 'GLOBAL',
    });
    expect(cryptoOfferRes.success).toBe(true);
    expect(cryptoOfferRes.data?.jurisdiction).toBe('US');
    expect(cryptoOfferRes.data?.report.eligibleCryptoOfferIds.length).toBe(1);

    // Step B4: Customer disarms workspace Kill Switch at $0.00
    const unlockRes = await setOpcWorkspaceKillSwitchAction({ active: false });
    expect(unlockRes.success).toBe(true);
    expect(unlockRes.data?.killSwitchReady).toBe(true);
    expect(unlockRes.data?.voiceByokReady).toBe(true);
    expect(unlockRes.data?.videoByokReady).toBe(true);
    expect(unlockRes.data?.youtubeChannelReady).toBe(true);
    expect(unlockRes.data?.configPresentForGate1).toBe(true);
    expect(unlockRes.data?.gate1ReadyForLiveProof).toBe(true);
    expect(unlockRes.data?.blockers).toEqual([]);
    expect(unlockRes.data?.readinessCheckCostCents).toBe(0);

    // Zero Inngest events dispatched during $0.00 pre-flight setup
    expect(mockInngestSend).not.toHaveBeenCalled();
  });
});
