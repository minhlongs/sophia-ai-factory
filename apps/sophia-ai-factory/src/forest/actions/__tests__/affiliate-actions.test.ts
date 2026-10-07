/**
 * Unit & Integration Test Suite for Affiliate Forest Server Actions
 *
 * Verifies:
 * 1. Cryptographically secure 256-bit token entropy generator
 * 2. inviteAffiliateAction: input validation, rate limiting, D1 persistence, IoC email dispatch
 * 3. validateAffiliateInviteAction: token lookup, expiration gating, status checks
 * 4. acceptAffiliateInviteAction: atomic OCC redemption, partner profile creation, referral link generation
 * 5. Error handling and resilience: Resend outage tolerance, DB disconnects, double-claim protection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSecureInviteToken,
  inviteAffiliateAction,
  validateAffiliateInviteAction,
  acceptAffiliateInviteAction,
  getAffiliateOffersAction,
  adoptAffiliateOfferAction,
} from '../affiliate-actions';
import * as dbClient from '@/seed/db/client';
import * as authSession from '@/seed/auth/better-auth-session';
import * as emailSender from '@/seed/email/email-sender';
import * as rateLimiter from '@/seed/security/d1-rate-limiter';

// Mock dependencies
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/email/email-sender', () => ({
  sendSeedEmail: vi.fn(),
}));

vi.mock('@/seed/security/d1-rate-limiter', () => ({
  checkD1RateLimit: vi.fn(),
}));

describe('Token Generation Entropy & Cryptographic Properties', () => {
  it('generates a 64-character hexadecimal string with 256 bits of entropy', () => {
    const token = generateSecureInviteToken();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it('generates unique tokens on subsequent invocations', () => {
    const tokenA = generateSecureInviteToken();
    const tokenB = generateSecureInviteToken();
    expect(tokenA).not.toBe(tokenB);
  });
});

describe('inviteAffiliateAction Validation & Dispatch', () => {
  let mockDb: any;
  let mockPreparedStatement: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPreparedStatement = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
    };

    mockDb = {
      prepare: vi.fn().mockReturnValue(mockPreparedStatement),
    };

    vi.mocked(dbClient.getD1).mockResolvedValue(mockDb);
    vi.mocked(authSession.getCurrentUser).mockResolvedValue({
      id: 'usr_admin_1',
      email: 'admin@sophia.io',
      role: 'admin',
    } as any);
    vi.mocked(rateLimiter.checkD1RateLimit).mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: Math.floor(Date.now() / 1000) + 60,
    });
    vi.mocked(emailSender.sendSeedEmail).mockResolvedValue({
      success: true,
      messageId: 'msg_resend_123',
    });
  });

  it('rejects partner name with less than 2 characters', async () => {
    const result = await inviteAffiliateAction({
      partnerName: 'A',
      email: 'partner@example.com',
      customRateOverridePct: 20,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Partner name is required');
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('rejects invalid email address formatting', async () => {
    const result = await inviteAffiliateAction({
      partnerName: 'Apex Partner',
      email: 'not-an-email',
      customRateOverridePct: 20,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('valid email');
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('rejects when rate limiter denies request', async () => {
    vi.mocked(rateLimiter.checkD1RateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Math.floor(Date.now() / 1000) + 60,
    });

    const result = await inviteAffiliateAction({
      partnerName: 'Apex Partner',
      email: 'apex@example.com',
      customRateOverridePct: 25,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limit exceeded');
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('handles database connection failure gracefully', async () => {
    vi.mocked(dbClient.getD1).mockResolvedValueOnce(null);

    const result = await inviteAffiliateAction({
      partnerName: 'Apex Partner',
      email: 'apex@example.com',
      customRateOverridePct: 25,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Database connection currently unavailable');
  });

  it('successfully creates D1 invite and dispatches bilingual email with clamped rate', async () => {
    const result = await inviteAffiliateAction({
      partnerName: 'Apex Media Agency',
      email: 'contact@apexmedia.com',
      customRateOverridePct: 120, // should clamp to 80
      welcomeMessage: 'Welcome to our top partner tier!',
      assetKitSelected: ['brand_kit', 'video_scripts'],
    });

    expect(result.success).toBe(true);
    expect(result.inviteId).toBeDefined();
    expect(result.emailDispatched).toBe(true);
    expect(result.inviteLink).toContain('/affiliate/join?token=');

    // Verify D1 insert parameters
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO affiliate_invites'));
    expect(mockPreparedStatement.bind).toHaveBeenCalledWith(
      result.inviteId,
      'usr_admin_1',
      'Apex Media Agency',
      'contact@apexmedia.com',
      80, // clamped
      'Welcome to our top partner tier!',
      JSON.stringify(['brand_kit', 'video_scripts']),
      expect.any(String), // token
      expect.any(Number), // expires_at
      expect.any(Number), // created_at
    );

    // Verify IoC email dispatch
    expect(emailSender.sendSeedEmail).toHaveBeenCalledWith({
      to: 'contact@apexmedia.com',
      subject: expect.stringContaining('Sophia AI Factory Partner Program'),
      html: expect.stringContaining('/affiliate/join?token='),
    });
  });

  it('tolerates email dispatch failure without failing the D1 invite creation', async () => {
    vi.mocked(emailSender.sendSeedEmail).mockResolvedValueOnce({
      success: false,
      error: 'Resend API rate limit or outage',
    });

    const result = await inviteAffiliateAction({
      partnerName: 'Apex Media Agency',
      email: 'contact@apexmedia.com',
      customRateOverridePct: 25,
    });

    expect(result.success).toBe(true);
    expect(result.emailDispatched).toBe(false);
    expect(result.inviteLink).toBeDefined();
    expect(mockDb.prepare).toHaveBeenCalled();
  });
});

describe('validateAffiliateInviteAction Verification', () => {
  let mockDb: any;
  let mockPreparedStatement: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPreparedStatement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
    };

    mockDb = {
      prepare: vi.fn().mockReturnValue(mockPreparedStatement),
    };

    vi.mocked(dbClient.getD1).mockResolvedValue(mockDb);
  });

  it('returns valid=false when token is empty or missing', async () => {
    const result = await validateAffiliateInviteAction('');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('NOT_FOUND');
  });

  it('returns valid=false and NOT_FOUND when token does not exist in D1', async () => {
    mockPreparedStatement.first.mockResolvedValueOnce(null);

    const result = await validateAffiliateInviteAction('non_existent_token_123');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('NOT_FOUND');
  });

  it('returns valid=false and ALREADY_REDEEMED when invite status is accepted', async () => {
    mockPreparedStatement.first.mockResolvedValueOnce({
      id: 'inv_1',
      invite_token: 'claimed_token',
      status: 'accepted',
      expires_at: Date.now() + 100000,
    });

    const result = await validateAffiliateInviteAction('claimed_token');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('ALREADY_REDEEMED');
  });

  it('returns valid=false and EXPIRED when expires_at timestamp is in the past', async () => {
    mockPreparedStatement.first.mockResolvedValueOnce({
      id: 'inv_1',
      invite_token: 'expired_token',
      status: 'pending',
      expires_at: Date.now() - 5000,
    });

    const result = await validateAffiliateInviteAction('expired_token');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EXPIRED');
  });

  it('returns valid=true and parsed invite details for valid pending invitation', async () => {
    const now = Date.now();
    mockPreparedStatement.first.mockResolvedValueOnce({
      id: 'inv_valid_1',
      inviter_user_id: 'usr_admin',
      partner_name: 'Starlight Media',
      email: 'partners@starlight.com',
      custom_commission_rate_pct: 30.0,
      welcome_message: 'Excited to work together!',
      asset_kit_urls: JSON.stringify(['brand_kit', 'demo_broll']),
      invite_token: 'valid_token_789',
      status: 'pending',
      expires_at: now + 86400000,
      created_at: now - 3600,
      updated_at: now - 3600,
    });

    const result = await validateAffiliateInviteAction('valid_token_789');
    expect(result.valid).toBe(true);
    expect(result.invite).toBeDefined();
    expect(result.invite?.partnerName).toBe('Starlight Media');
    expect(result.invite?.customCommissionRatePct).toBe(30.0);
    expect(result.invite?.welcomeMessage).toBe('Excited to work together!');
    expect(result.invite?.assetKits).toEqual(['brand_kit', 'demo_broll']);
  });
});

describe('acceptAffiliateInviteAction Atomic OCC Redemption', () => {
  let mockDb: any;
  let mockPreparedStatement: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPreparedStatement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
    };

    mockDb = {
      prepare: vi.fn().mockReturnValue(mockPreparedStatement),
    };

    vi.mocked(dbClient.getD1).mockResolvedValue(mockDb);
  });

  it('rejects missing token input', async () => {
    const result = await acceptAffiliateInviteAction({ token: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Token is required');
  });

  it('rejects non-existent invitation token', async () => {
    mockPreparedStatement.first.mockResolvedValueOnce(null);

    const result = await acceptAffiliateInviteAction({ token: 'unknown_token' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invitation not found');
  });

  it('rejects already redeemed invitation', async () => {
    mockPreparedStatement.first.mockResolvedValueOnce({
      id: 'inv_already_used',
      status: 'accepted',
      expires_at: Date.now() + 10000,
    });

    const result = await acceptAffiliateInviteAction({ token: 'already_used_token' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already been redeemed');
  });

  it('rejects expired invitation link', async () => {
    mockPreparedStatement.first.mockResolvedValueOnce({
      id: 'inv_expired',
      status: 'pending',
      expires_at: Date.now() - 10000,
    });

    const result = await acceptAffiliateInviteAction({ token: 'expired_token' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('handles OCC concurrency conflict when changes count is 0', async () => {
    mockPreparedStatement.first.mockResolvedValueOnce({
      id: 'inv_conflict',
      partner_name: 'Concurrent Partner',
      status: 'pending',
      expires_at: Date.now() + 10000,
      custom_commission_rate_pct: 25.0,
    });

    // Simulate concurrent thread winning the race (0 changes)
    mockPreparedStatement.run.mockResolvedValueOnce({ success: true, meta: { changes: 0 } });

    const result = await acceptAffiliateInviteAction({ token: 'race_token' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already claimed');
  });

  it('successfully executes atomic OCC redemption and creates active partner record', async () => {
    const now = Date.now();
    mockPreparedStatement.first.mockResolvedValueOnce({
      id: 'inv_success_123',
      partner_name: 'Apex Growth Agency',
      email: 'partners@apexgrowth.com',
      custom_commission_rate_pct: 35.0,
      status: 'pending',
      expires_at: now + 500000,
    });

    mockPreparedStatement.run
      .mockResolvedValueOnce({ success: true, meta: { changes: 1 } }) // OCC update on affiliate_invites
      .mockResolvedValueOnce({ success: true, meta: { changes: 1 } }); // INSERT into affiliate_partners

    const result = await acceptAffiliateInviteAction({
      token: 'valid_occ_token_999',
      preferredPartnerCode: 'APEX_GROWTH',
    });

    expect(result.success).toBe(true);
    expect(result.partnerId).toBeDefined();
    expect(result.partnerCode).toContain('APEX_GROWTH');
    expect(result.referralLink).toContain(`/r/${result.partnerCode}`);

    // Verify atomic OCC update query was executed
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE affiliate_invites\n         SET status = 'accepted'"),
    );

    // Verify affiliate_partners insert query was executed with custom commission rate
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO affiliate_partners'),
    );
  });
});

describe('getAffiliateOffersAction & adoptAffiliateOfferAction (Milestone 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully fetches affiliate offers with authentic fallback', async () => {
    const result = await getAffiliateOffersAction({ limit: 10 });

    expect(result.success).toBe(true);
    expect(result.offers).toBeDefined();
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);

    const first = result.offers[0];
    expect(first.programName).toBeDefined();
    expect(first.destinationUrl).toBeDefined();
    expect(first.category).toBeDefined();
    expect(first.payoutModel).toBeDefined();
  });

  it('filters affiliate offers by category', async () => {
    const result = await getAffiliateOffersAction({ category: 'SaaS' });

    expect(result.success).toBe(true);
    expect(result.offers.length).toBeGreaterThan(0);
    result.offers.forEach((offer) => {
      expect(offer.category.toLowerCase()).toBe('saas');
    });
  });

  it('rejects adoptAffiliateOfferAction when offerId is missing or empty', async () => {
    const result = await adoptAffiliateOfferAction({
      offerId: '',
      target: 'creator_studio',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('offerId');
  });

  it('rejects adoptAffiliateOfferAction when target is invalid', async () => {
    const result = await adoptAffiliateOfferAction({
      offerId: 'semrush',
      target: 'invalid_target' as any,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('target');
  });

  it('successfully adopts offer into creator_studio and returns deep link', async () => {
    const result = await adoptAffiliateOfferAction({
      offerId: 'semrush',
      target: 'creator_studio',
    });

    expect(result.success).toBe(true);
    expect(result.campaignId).toBeDefined();
    expect(result.target).toBe('creator_studio');
    expect(result.deepLink).toContain('/creator/studio?offerId=semrush&campaignId=');
    expect(result.message).toContain('Creator Studio');
  });

  it('successfully adopts offer into distribution_queue and returns queue deep link', async () => {
    const result = await adoptAffiliateOfferAction({
      offerId: 'shopify',
      target: 'distribution_queue',
    });

    expect(result.success).toBe(true);
    expect(result.campaignId).toBeDefined();
    expect(result.target).toBe('distribution_queue');
    expect(result.deepLink).toContain('/creator/studio?tab=queue&campaignId=');
    expect(result.message).toContain('distribution');
  });
});

