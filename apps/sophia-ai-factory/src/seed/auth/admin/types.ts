/**
 * Admin Authentication & Authorization Types
 * Layer: seed
 *
 * @module seed/auth/admin/types
 */

import type { NextResponse } from 'next/server';
import type { User } from '@/seed/db/client';

export type RequireAdminResult = { user: User } | NextResponse;

/** Result type for recent-auth challenge check. */
export type RecentAuthResult =
  | { ok: true }
  | { ok: false; reason: 'no-challenge' | 'expired' | 'invalid' };

/**
 * Payload embedded in the admin_challenge_token cookie.
 * Signed via HMAC-SHA-256 with BETTER_AUTH_SECRET.
 * Format (JSON): {"userId":"...","issuedAt":1234567890}
 */
export interface ChallengePayload {
  userId: string;
  issuedAt: number;
}
