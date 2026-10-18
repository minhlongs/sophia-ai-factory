import type {
  CronRunRow,
  QueueRow,
  FailedVideoRow,
  FailedCountRow,
  ReconcileRow,
  OutageEventRow,
} from './types';

export async function fetchCronRuns(db: D1Database): Promise<CronRunRow[]> {
  const result = await db
    .prepare(
      `SELECT cron_name, last_run_at, last_status, last_error, run_count
       FROM cron_run_log ORDER BY last_run_at DESC LIMIT 20`,
    )
    .all<CronRunRow>();
  return result.results ?? [];
}

export async function fetchActiveQueue(db: D1Database): Promise<{
  queued: number;
  processing: number;
  total: number;
}> {
  const result = await db
    .prepare(
      `SELECT status, COUNT(*) AS cnt FROM videos
       WHERE status IN ('queued', 'processing') GROUP BY status`,
    )
    .all<QueueRow>();

  const queueMap: Record<string, number> = {};
  for (const row of result.results ?? []) {
    queueMap[row.status] = row.cnt;
  }
  const queued = queueMap['queued'] ?? 0;
  const processing = queueMap['processing'] ?? 0;
  return { queued, processing, total: queued + processing };
}

export async function fetchFailedPermanent24h(
  db: D1Database,
  since24h: number,
): Promise<{ count: number; samples: FailedVideoRow[] }> {
  const failedResult = await db
    .prepare(
      `SELECT id, purchase_id, last_error, created_at FROM videos
       WHERE status = 'failed_permanent' AND created_at >= ?1
       ORDER BY created_at DESC LIMIT 10`,
    )
    .bind(since24h)
    .all<FailedVideoRow>();

  const failedCountRow = await db
    .prepare(`SELECT COUNT(*) AS cnt FROM videos WHERE status = 'failed_permanent' AND created_at >= ?1`)
    .bind(since24h)
    .first<FailedCountRow>();

  return {
    count: failedCountRow?.cnt ?? 0,
    samples: failedResult.results ?? [],
  };
}

export async function fetchReconcile24h(
  db: D1Database,
  since24h: number,
  failedPermanentCount: number,
): Promise<{
  paid: number;
  delivered: number;
  mismatch: number;
  failedPermanent: number;
}> {
  const reconcileResult = await db
    .prepare(
      `SELECT COUNT(*) AS paid,
              SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END) AS delivered
       FROM user_purchases up
       LEFT JOIN videos v ON v.purchase_id = up.id AND v.status = 'completed'
       WHERE up.kind = 'one_time' AND up.status = 'paid' AND up.paid_at >= ?1
         AND up.payment_id NOT LIKE 'SYNTHETIC_%'
         AND up.payment_id NOT LIKE 'ADMIN_SYNTHETIC_%'`,
    )
    .bind(since24h)
    .first<ReconcileRow>();

  const paid = reconcileResult?.paid ?? 0;
  const delivered = reconcileResult?.delivered ?? 0;
  return { paid, delivered, mismatch: paid - delivered, failedPermanent: failedPermanentCount };
}

export async function fetchOutageNotifications(
  db: D1Database,
  since24h: number,
): Promise<{ lastTriggeredAt: number | null; customersNotified24h: number }> {
  const outageResult = await db
    .prepare(
      `SELECT COUNT(*) AS cnt,
              MAX(json_extract(event_data, '$.opened_at')) AS latest_at
       FROM billing_events
       WHERE event_type = 'outage_compensation'
         AND created_at >= ?1`,
    )
    .bind(since24h)
    .first<OutageEventRow>();

  return {
    lastTriggeredAt: outageResult?.latest_at ? Number(outageResult.latest_at) : null,
    customersNotified24h: outageResult?.cnt ?? 0,
  };
}
