import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';

export async function requireAuthUser() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new Error('UNAUTHORIZED: Authentication required to perform creator operations.');
  }
  return user;
}

export async function getRequiredD1() {
  const db = await getD1();
  if (!db) {
    throw new Error('DATABASE_UNAVAILABLE: Cloudflare D1 database connection unavailable.');
  }
  return db;
}
