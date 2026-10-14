/**
 * Initial challenge seed catalog and seed helper for SOP Marketplace Challenges.
 * @module land/sop-marketplace/challenges-seed
 */

/** Seed initial challenges (INSERT OR IGNORE — safe to call repeatedly) */
export async function seedInitialChallenges(db: D1Database): Promise<void> {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  const challenges = [
    {
      id: 'challenge-ship-10-videos',
      title_en: 'Ship 10 Videos',
      title_vi: 'Tạo 10 Video',
      description_en: 'Run 10 SOP executions in 30 days',
      description_vi: 'Chạy 10 SOP trong 30 ngày',
      goal_type: 'sop_runs',
      goal_value: 10,
      reward_type: 'badge',
      reward_value: 'video-producer',
    },
    {
      id: 'challenge-first-sale',
      title_en: 'First SOP Sale',
      title_vi: 'Bán SOP đầu tiên',
      description_en: 'Sell your first community SOP on the marketplace',
      description_vi: 'Bán SOP cộng đồng đầu tiên trên marketplace',
      goal_type: 'sop_sales',
      goal_value: 1,
      reward_type: 'credits',
      reward_value: '50',
    },
    {
      id: 'challenge-earn-100',
      title_en: 'Earn $100 Commission',
      title_vi: 'Kiếm $100 hoa hồng',
      description_en: 'Earn $100 in total affiliate + SOP commission',
      description_vi: 'Kiếm tổng cộng $100 hoa hồng affiliate + SOP',
      goal_type: 'commission_earned',
      goal_value: 10000,
      reward_type: 'commission_boost',
      reward_value: '1.1x',
    },
  ];

  for (const c of challenges) {
    await db
      .prepare(`
      INSERT OR IGNORE INTO sop_challenges
        (id, title_en, title_vi, description_en, description_vi, goal_type, goal_value, reward_type, reward_value, starts_at, ends_at, status, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'active', ?10)
    `)
      .bind(
        c.id,
        c.title_en,
        c.title_vi,
        c.description_en,
        c.description_vi,
        c.goal_type,
        c.goal_value,
        c.reward_type,
        c.reward_value,
        now,
        now + thirtyDays,
      )
      .run();
  }
}
