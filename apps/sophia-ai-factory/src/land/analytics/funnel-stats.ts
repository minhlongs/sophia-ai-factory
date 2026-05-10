/**
 * Activation funnel analytics.
 *
 * Single primitive that counts users at each step of the activation funnel
 * within a signup date window:
 *   1. Signup (user.createdAt within window)
 *   2. First login (≥1 session row)
 *   3. First video (≥1 video_jobs row)
 *   4. First conversion (≥1 conversion_events.status IN ('approved','paid'))
 *
 * Used by /dashboard/admin/funnel + /api/admin/funnel. All queries are
 * tenant-agnostic (admin scope) and use indexed columns where possible.
 *
 * @module land/analytics/funnel-stats
 */

import { getD1Raw } from '@/seed/db/client';

export interface ActivationFunnel {
  /** Unix seconds, inclusive. */
  fromTs: number;
  /** Unix seconds, inclusive. */
  toTs: number;
  signups: number;
  firstLogin: number;
  firstVideo: number;
  firstConversion: number;
  conversions: {
    signupToLogin: number;
    loginToVideo: number;
    videoToConversion: number;
  };
}

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
  const db = await getD1Raw();

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
         AND EXISTS (SELECT 1 FROM video_jobs v WHERE v.user_id = u.id)`,
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
