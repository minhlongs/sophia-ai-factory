import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

export const dynamic = 'force-dynamic';

type VideoStat = { date: string; views: number; revenue: number };
type AffiliateStat = { network: string; conversions: number; revenue: number };
type FunnelStat = { stage: string; count: number };

export default async function AnalyticsPage() {
  const db = createServerClient();
  const user = await getCurrentUser();
  if (!user) return <div className="p-6">Unauthorized</div>;

  const [videoRows, affiliateRows, funnelRows] = await Promise.all([
    db.prepare(
      'SELECT date, views, revenue FROM video_analytics WHERE user_id = ?1 ORDER BY date DESC LIMIT 30'
    )
      .bind(user.id)
      .all<VideoStat>(),
    db.prepare(
      'SELECT network, conversions, revenue FROM affiliate_conversions WHERE user_id = ?1 ORDER BY revenue DESC LIMIT 20'
    )
      .bind(user.id)
      .all<AffiliateStat>(),
    db.prepare(
      `WITH stages AS (
         SELECT 'signup' AS stage, COUNT(*) AS count FROM users WHERE id = ?1
         UNION ALL
         SELECT 'setup', COUNT(*) FROM user_profiles WHERE user_id = ?1 AND telegram_chat_id IS NOT NULL
         UNION ALL
         SELECT 'first_video', COUNT(*) FROM videos WHERE user_id = ?1 AND status = 'completed'
         UNION ALL
         SELECT 'paid', COUNT(*) FROM payment_events WHERE user_id = ?1 AND status = 'confirmed'
       )
       SELECT * FROM stages`
    )
      .bind(user.id)
      .all<FunnelStat>(),
  ]);

  const videos = (videoRows.results as VideoRow[] | VideoStat[] | undefined) ?? [];
  const affiliates = (affiliateRows.results as AffiliateStat[] | undefined) ?? [];
  const funnel = (funnelRows.results as FunnelStat[] | undefined) ?? [];

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Signup</div>
          <div className="text-2xl font-bold">{funnel[0]?.count ?? 0}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Setup</div>
          <div className="text-2xl font-bold">{funnel[1]?.count ?? 0}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">First Video</div>
          <div className="text-2xl font-bold">{funnel[2]?.count ?? 0}</div>
        </div>
        <div className="rounded border p-4">
          <div className="text-sm text-gray-500">Paid</div>
          <div className="text-2xl font-bold">{funnel[3]?.count ?? 0}</div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Video Views (last 30 days)</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-right">Views</th>
                <th className="p-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((row) => (
                <tr key={row.date} className="border-b">
                  <td className="p-2">{row.date}</td>
                  <td className="p-2 text-right">{row.views}</td>
                  <td className="p-2 text-right">{row.revenue}</td>
                </tr>
              ))}
              {videos.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-500">
                    No data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Affiliate Revenue</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">Network</th>
                <th className="p-2 text-right">Conversions</th>
                <th className="p-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.map((row) => (
                <tr key={row.network} className="border-b">
                  <td className="p-2">{row.network}</td>
                  <td className="p-2 text-right">{row.conversions}</td>
                  <td className="p-2 text-right">{row.revenue}</td>
                </tr>
              ))}
              {affiliates.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-500">
                    No data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
