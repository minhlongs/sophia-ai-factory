/**
 * Common Auth and DB Helpers for Clearing Server Actions
 * @module land/clearing/actions/common
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';

/**
 * Ensures caller is an authenticated user session.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new Error('UNAUTHORIZED: You must be signed in to perform clearing operations.');
  }
  return user;
}

/**
 * Resolves active D1 database or throws typed error.
 */
export async function getRequiredD1() {
  const db = await getD1();
  if (!db) {
    throw new Error('DATABASE_UNAVAILABLE: Cloudflare D1 database binding is unavailable.');
  }
  return db;
}
