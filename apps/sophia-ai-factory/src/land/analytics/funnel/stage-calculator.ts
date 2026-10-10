import { getD1 } from '@/seed/db/client';
import type { ActivationFunnel } from './types';

/**
 * Compute activation funnel counts for users who signed up within the window.
 * Subsequent step counts are restricted to that signup cohort — i.e.
 * `firstLogin` only counts users in the cohort who later logged in (timing of
 * the login itself can fall outside the window).
 */
export async function getActivationFunnel(
  fromTs: number,
  toTs: number,
): Promise<ActivationFunnel> {
  if (fromTs > toTs) throw new Error('fromTs must be <= toTs');
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const fromIso = new Date(fromTs * 1000).toISOString();
  const toIso = new Date(toTs * 1000).toISOString();

  const cohortClause = `datetime(u.createdAt) >= datetime(?1)
                        AND datetime(u.createdAt) <= datetime(?2)`;

  const signupRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM "user" u WHERE ${cohortClause}`)
    .bind(fromIso, toIso)
    .first<{ n: number }>();

  const loginRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM "user" u
       WHERE ${cohortClause}
         AND EXISTS (SELECT 1 FROM "session" s WHERE s.userId = u.id)`,
    )
    .bind(fromIso, toIso)
    .first<{ n: number }>();

  const videoRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM "user" u
       WHERE ${cohortClause}
         AND EXISTS (SELECT 1 FROM videos v WHERE v.user_id = u.id)`,
    )
    .bind(fromIso, toIso)
    .first<{ n: number }>();

  const conversionRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM "user" u
       WHERE ${cohortClause}
         AND EXISTS (
           SELECT 1
           FROM conversion_events cv
           JOIN affiliate_links al ON al.id = cv.link_id
           WHERE al.user_id = u.id
             AND cv.status IN ('approved','paid')
         )`,
    )
    .bind(fromIso, toIso)
    .first<{ n: number }>();

  const signups = Number(signupRow?.n ?? 0);
  const firstLogin = Number(loginRow?.n ?? 0);
  const firstVideo = Number(videoRow?.n ?? 0);
  const firstConversion = Number(conversionRow?.n ?? 0);

  return {
    fromTs,
    toTs,
    signups,
    firstLogin,
    firstVideo,
    firstConversion,
    conversions: {
      signupToLogin: signups > 0 ? firstLogin / signups : 0,
      loginToVideo: firstLogin > 0 ? firstVideo / firstLogin : 0,
      videoToConversion: firstVideo > 0 ? firstConversion / firstVideo : 0,
    },
  };
}
