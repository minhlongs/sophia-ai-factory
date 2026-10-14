import { emit } from '@/land/webhooks/emitter';
import { ErrorRow, D1Binding, ERROR_THRESHOLD } from './types';

export async function fetchRecentErrors(db: D1Binding): Promise<ErrorRow[]> {
  const result = await db
    .prepare(
      `SELECT msg_class, fingerprint, count(*) as c
       FROM error_log
       WHERE ts > datetime('now', '-24 hours')
       GROUP BY fingerprint
       ORDER BY c DESC
       LIMIT 50`
    )
    .bind()
    .all();
  return result.results ?? [];
}

export function checkAndEmitThreshold(db: D1Binding, rows: ErrorRow[], errorCount: number): void {
  if (errorCount > ERROR_THRESHOLD) {
    const sampleErrors = rows.slice(0, 5).map((r) => ({
      message: r.msg_class,
      timestamp: new Date().toISOString(),
    }));
    const severity = errorCount > 100 ? 'critical' : errorCount > 50 ? 'high' : 'medium';
    emit(
      { DB: db as unknown as D1Database },
      'error.threshold',
      {
        tenantId: 'system',
        errorCount24h: errorCount,
        severity,
        sampleErrors,
      },
      'system'
    );
  }
}
