/**
 * Video Review Service & Cryptographic Token Security Test Suite
 *
 * Validates:
 * - 256-bit CSPRNG review token generation, SHA-256 hash storage, and expiry check
 * - Review link generation, token-to-record resolution, and client branding join
 * - Timestamped feedback submission and sequential accumulation
 * - Client review decisions (Approve / Request Changes)
 * - Automated social distribution trigger hook upon video approval
 *
 * Layer: tree/organizations/__tests__
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import {
  generateReviewToken,
  sha256Hex,
  isReviewTokenExpired,
  timingSafeEqual,
  DEFAULT_REVIEW_TOKEN_TTL_MS,
} from '@/seed/security/review-token';
import {
  createVideoReviewLink,
  resolveReviewByToken,
  addReviewFeedback,
  submitReviewDecision,
  triggerAutoPublishHook,
} from '../review-service';
import { createSubaccount } from '../subaccount-repo';

function createTestD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_subaccounts (
      id TEXT PRIMARY KEY,
      agency_org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      custom_domain TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (lower(status) IN ('active', 'suspended', 'archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (agency_org_id, slug)
    );

    CREATE TABLE IF NOT EXISTS subaccount_branding (
      subaccount_id TEXT PRIMARY KEY REFERENCES client_subaccounts(id) ON DELETE CASCADE,
      logo_url TEXT,
      primary_color TEXT DEFAULT '#0f172a',
      accent_color TEXT DEFAULT '#10b981',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subaccount_mcu_allocations (
      id TEXT PRIMARY KEY,
      subaccount_id TEXT NOT NULL REFERENCES client_subaccounts(id) ON DELETE CASCADE,
      allocated_mcu INTEGER NOT NULL DEFAULT 0,
      used_mcu INTEGER NOT NULL DEFAULT 0,
      period_start TEXT,
      period_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (subaccount_id)
    );

    CREATE TABLE IF NOT EXISTS video_reviews (
      id TEXT PRIMARY KEY,
      subaccount_id TEXT NOT NULL REFERENCES client_subaccounts(id) ON DELETE CASCADE,
      video_id TEXT NOT NULL,
      video_title TEXT,
      video_url TEXT,
      token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (lower(status) IN ('pending', 'approved', 'changes_requested')),
      feedback_comments TEXT NOT NULL DEFAULT '[]',
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS video_publishes (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...vals: unknown[]) {
          bound = vals;
          return this;
        },
        async run(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const res = stmt.run(...params);
          return {
            success: true,
            meta: { changes: Number(res.changes), duration: 1 },
            changes: Number(res.changes),
            lastInsertRowid: res.lastInsertRowid,
          };
        },
        async all(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...params);
          return {
            results,
            meta: { changes: 0, duration: 1 },
          };
        },
        async first(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...params);
          return row ?? null;
        },
      };
    },
  } as unknown as D1Database;
}

describe('Video Review Service & Token Security', () => {
  let db: D1Database;
  let subaccountId: string;

  beforeEach(async () => {
    db = createTestD1();

    await db
      .prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)')
      .bind('org_agency_01', 'Viral Scale Agency', 'viral-scale')
      .run();

    const sub = await createSubaccount(db, {
      agencyOrgId: 'org_agency_01',
      name: 'Luxury Cosmetics Co',
      slug: 'luxury-cosmetics',
      customDomain: 'review.luxurycosmetics.com',
      branding: {
        logoUrl: 'https://cdn.cosmetics.com/logo.svg',
        primaryColor: '#831843',
        accentColor: '#f43f5e',
      },
    });
    subaccountId = sub.id;
  });

  describe('review-token cryptographic security', () => {
    it('generates high-entropy 256-bit CSPRNG token (64 hex characters) and matching SHA-256 hash', async () => {
      const { rawToken, tokenHash, expiresAt } = await generateReviewToken();

      expect(rawToken).toHaveLength(64);
      expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
      expect(tokenHash).toHaveLength(64);
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);

      // Verify that SHA-256 hash of rawToken strictly equals tokenHash
      const computedHash = await sha256Hex(rawToken);
      expect(computedHash).toBe(tokenHash);

      // Verify expiration defaults to ~7 days in the future
      const expiryMs = new Date(expiresAt).getTime();
      const diff = expiryMs - Date.now();
      expect(diff).toBeGreaterThan(DEFAULT_REVIEW_TOKEN_TTL_MS - 5000);
      expect(diff).toBeLessThanOrEqual(DEFAULT_REVIEW_TOKEN_TTL_MS + 5000);
    });

    it('generates unique tokens on each invocation', async () => {
      const token1 = await generateReviewToken();
      const token2 = await generateReviewToken();
      expect(token1.rawToken).not.toBe(token2.rawToken);
      expect(token1.tokenHash).not.toBe(token2.tokenHash);
    });

    it('correctly validates expired vs valid expiration timestamps', () => {
      const now = Date.now();
      const past = new Date(now - 10000).toISOString();
      const future = new Date(now + 60000).toISOString();

      expect(isReviewTokenExpired(past, now)).toBe(true);
      expect(isReviewTokenExpired(future, now)).toBe(false);
      expect(isReviewTokenExpired('invalid-date', now)).toBe(true);
    });

    it('performs timing-safe string comparison', () => {
      expect(timingSafeEqual('hash123', 'hash123')).toBe(true);
      expect(timingSafeEqual('hash123', 'hash124')).toBe(false);
      expect(timingSafeEqual('short', 'longer_string')).toBe(false);
    });
  });

  describe('review-service link creation and resolution', () => {
    it('creates a tokenized review link and only stores token hash in D1', async () => {
      const result = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_launch_001',
        videoTitle: 'Q4 Viral Launch Campaign',
        videoUrl: 'https://r2.sophia.network/videos/launch_001.mp4',
        baseUrl: 'https://agency.sophia.network',
      });

      expect(result.reviewId).toMatch(/^rev_/);
      expect(result.rawToken).toHaveLength(64);
      expect(result.reviewUrl).toBe(`https://agency.sophia.network/client-review/${result.rawToken}`);

      // Verify rawToken is NOT in D1, only tokenHash is in D1
      const rawInDb = await db
        .prepare('SELECT id FROM video_reviews WHERE token_hash = ?')
        .bind(result.rawToken)
        .first();
      expect(rawInDb).toBeNull();

      const hash = await sha256Hex(result.rawToken);
      const hashInDb = await db
        .prepare('SELECT id FROM video_reviews WHERE token_hash = ?')
        .bind(hash)
        .first<{ id: string }>();
      expect(hashInDb?.id).toBe(result.reviewId);
    });

    it('fails when subaccountId or videoId is missing', async () => {
      await expect(
        createVideoReviewLink(db, { subaccountId: '', videoId: 'vid_1' })
      ).rejects.toThrow(/VALIDATION_ERROR/);

      await expect(
        createVideoReviewLink(db, { subaccountId, videoId: '   ' })
      ).rejects.toThrow(/VALIDATION_ERROR/);
    });

    it('resolves review payload with subaccount branding by raw token', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_branded_002',
        videoTitle: 'Autumn Cosmetics Promo',
        videoUrl: 'https://r2.sophia.network/cosmetics.mp4',
      });

      const payload = await resolveReviewByToken(db, rawToken);

      expect(payload.token).toBe(rawToken);
      expect(payload.subaccountId).toBe(subaccountId);
      expect(payload.videoId).toBe('vid_branded_002');
      expect(payload.videoTitle).toBe('Autumn Cosmetics Promo');
      expect(payload.videoUrl).toBe('https://r2.sophia.network/cosmetics.mp4');
      expect(payload.status).toBe('PENDING');
      expect(payload.feedbackComments).toEqual([]);
      expect(payload.isExpired).toBe(false);

      // Verify joined client branding
      expect(payload.subaccountBranding?.clientName).toBe('Luxury Cosmetics Co');
      expect(payload.subaccountBranding?.logoUrl).toBe('https://cdn.cosmetics.com/logo.svg');
      expect(payload.subaccountBranding?.primaryColor).toBe('#831843');
      expect(payload.subaccountBranding?.accentColor).toBe('#f43f5e');
    });

    it('rejects invalid or non-existent tokens', async () => {
      await expect(
        resolveReviewByToken(db, 'deadbeef'.repeat(8))
      ).rejects.toThrow(/REVIEW_NOT_FOUND/);

      await expect(
        resolveReviewByToken(db, '')
      ).rejects.toThrow(/VALIDATION_ERROR/);
    });

    it('detects expired review links upon resolution', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_expired_003',
        ttlMs: -1000, // expired 1s ago
      });

      const payload = await resolveReviewByToken(db, rawToken);
      expect(payload.isExpired).toBe(true);
    });
  });

  describe('interactive feedback comments', () => {
    it('appends timestamped feedback comments sequentially', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_feedback_004',
      });

      // Add comment at 15s
      const comments1 = await addReviewFeedback(db, {
        token: rawToken,
        comment: 'Please shorten the intro logo animation',
        author: 'Brand Manager',
        timestampSec: 15,
      });
      expect(comments1).toHaveLength(1);
      expect(comments1[0].comment).toBe('Please shorten the intro logo animation');
      expect(comments1[0].author).toBe('Brand Manager');
      expect(comments1[0].timestampSec).toBe(15);

      // Add comment at 42s
      const comments2 = await addReviewFeedback(db, {
        token: rawToken,
        comment: 'Call-to-action text color should be brighter',
        author: 'Creative Director',
        timestampSec: 42,
      });
      expect(comments2).toHaveLength(2);
      expect(comments2[1].timestampSec).toBe(42);

      // Resolve review and verify comments are preserved
      const payload = await resolveReviewByToken(db, rawToken);
      expect(payload.feedbackComments).toHaveLength(2);
      expect(payload.feedbackComments?.[0].timestampSec).toBe(15);
      expect(payload.feedbackComments?.[1].timestampSec).toBe(42);
    });

    it('rejects empty comments or comments on expired review links', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_comment_fail',
      });

      await expect(
        addReviewFeedback(db, { token: rawToken, comment: '   ' })
      ).rejects.toThrow(/VALIDATION_ERROR/);

      const expired = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_expired_comment',
        ttlMs: -5000,
      });

      await expect(
        addReviewFeedback(db, { token: expired.rawToken, comment: 'Nice video' })
      ).rejects.toThrow(/REVIEW_EXPIRED/);
    });
  });

  describe('client review decisions and automated publish hook', () => {
    it('processes request_changes decision and updates status', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_changes_005',
      });

      const decision = await submitReviewDecision(db, {
        token: rawToken,
        decision: 'request_changes',
        feedbackNote: 'Needs voiceover re-recording at segment 2',
        author: 'Client Reviewer',
      });

      expect(decision.success).toBe(true);
      expect(decision.status).toBe('CHANGES_REQUESTED');
      expect(decision.autoPublishTriggered).toBe(false);

      const resolved = await resolveReviewByToken(db, rawToken);
      expect(resolved.status).toBe('CHANGES_REQUESTED');
      expect(resolved.feedbackComments).toHaveLength(1);
      expect(resolved.feedbackComments?.[0].comment).toContain('voiceover');
    });

    it('processes approve decision and triggers auto-publishing hook', async () => {
      // Seed a pending publish record for this video
      await db
        .prepare("INSERT INTO video_publishes (id, video_id, platform, status) VALUES (?, ?, ?, 'pending')")
        .bind('pub_001', 'vid_approve_006', 'tiktok')
        .run();

      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_approve_006',
        videoTitle: 'Ready To Viral Video',
      });

      const decision = await submitReviewDecision(db, {
        token: rawToken,
        decision: 'approve',
        feedbackNote: 'Looks fantastic, ready to publish!',
        author: 'VP Marketing',
      });

      expect(decision.success).toBe(true);
      expect(decision.status).toBe('APPROVED');
      expect(decision.autoPublishTriggered).toBe(true);
      expect(decision.triggerResult?.dispatched).toBe(true);

      // Verify that video_publishes was transitioned to scheduled
      const pubRow = await db
        .prepare('SELECT status FROM video_publishes WHERE id = ?')
        .bind('pub_001')
        .first<{ status: string }>();
      expect(pubRow?.status).toBe('scheduled');

      // Verify review record status
      const resolved = await resolveReviewByToken(db, rawToken);
      expect(resolved.status).toBe('APPROVED');
    });

    it('rejects invalid decision types or expired review decisions', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_invalid_dec',
      });

      await expect(
        submitReviewDecision(db, {
          token: rawToken,
          // @ts-expect-error test invalid string
          decision: 'reject_permanently',
        })
      ).rejects.toThrow(/VALIDATION_ERROR/);

      const expired = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_expired_dec',
        ttlMs: -5000,
      });

      await expect(
        submitReviewDecision(db, {
          token: expired.rawToken,
          decision: 'approve',
        })
      ).rejects.toThrow(/REVIEW_EXPIRED/);
    });

    it('executes triggerAutoPublishHook safely even if table does not exist', async () => {
      const hookResult = await triggerAutoPublishHook(db, {
        subaccountId,
        videoId: 'vid_standalone_hook',
      });
      expect(hookResult.dispatched).toBe(true);
      expect(hookResult.channel).toBe('social_distribution_queue');
    });

    it('enforces state machine guard: prevents regressing approved review to changes_requested and provides idempotent repeated approval', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_state_guard_007',
        videoTitle: 'State Guard Video',
      });

      // 1. Initial approval
      const firstApproval = await submitReviewDecision(db, {
        token: rawToken,
        decision: 'approve',
        feedbackNote: 'Approved initially',
      });
      expect(firstApproval.success).toBe(true);
      expect(firstApproval.status).toBe('APPROVED');
      expect(firstApproval.autoPublishTriggered).toBe(true);

      // 2. Repeated approval is idempotent
      const duplicateApproval = await submitReviewDecision(db, {
        token: rawToken,
        decision: 'approve',
        feedbackNote: 'Duplicate approve note',
      });
      expect(duplicateApproval.success).toBe(true);
      expect(duplicateApproval.status).toBe('APPROVED');
      expect(duplicateApproval.alreadyApproved).toBe(true);
      expect(duplicateApproval.autoPublishTriggered).toBe(false);

      // 3. Regressing to request_changes is strictly forbidden
      await expect(
        submitReviewDecision(db, {
          token: rawToken,
          decision: 'request_changes',
          feedbackNote: 'Attempt to rollback approval',
        })
      ).rejects.toThrow(/ALREADY_APPROVED/);

      // Verify DB record status remains approved
      const resolved = await resolveReviewByToken(db, rawToken);
      expect(resolved.status).toBe('APPROVED');
      // Verify feedback note was not duplicated
      expect(resolved.feedbackComments).toHaveLength(1);
      expect(resolved.feedbackComments?.[0].comment).toBe('Approved initially');
    });

    it('rejects empty or whitespace-only tokens across resolve, feedback, and decision functions', async () => {
      const whitespaceTokens = ['', '   ', '\t\n '];

      for (const badToken of whitespaceTokens) {
        await expect(resolveReviewByToken(db, badToken)).rejects.toThrow(/VALIDATION_ERROR: INVALID_TOKEN/);
        await expect(
          addReviewFeedback(db, { token: badToken, comment: 'Comment' })
        ).rejects.toThrow(/VALIDATION_ERROR: INVALID_TOKEN/);
        await expect(
          submitReviewDecision(db, { token: badToken, decision: 'approve' })
        ).rejects.toThrow(/VALIDATION_ERROR: INVALID_TOKEN/);
      }
    });
  });
});
