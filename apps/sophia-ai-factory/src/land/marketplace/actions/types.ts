/**
 * Marketplace Server Action Types & Core Helpers
 *
 * Layer: land
 *
 * @module land/marketplace/actions/types
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Asserts active user session or throws unauthorized error.
 */
export async function requireAuthUser() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new Error('UNAUTHORIZED: Please sign in to perform this action.');
  }
  return user;
}

/**
 * Asserts D1 database binding or throws service unavailable error.
 */
export async function getRequiredD1() {
  const db = await getD1();
  if (!db) {
    throw new Error('DATABASE_UNAVAILABLE: D1 database binding is unavailable.');
  }
  return db;
}
