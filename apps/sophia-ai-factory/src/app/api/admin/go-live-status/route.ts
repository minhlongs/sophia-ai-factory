/**
 * GET /api/admin/go-live-status — system readiness checks for go-live checklist (admin only).
 *
 * @module app/api/admin/go-live-status/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { getD1 } from '@/seed/db/client'

export const dynamic = 'force-dynamic'

interface CheckResult {
  key: string
  label_vi: string
  label_en: string
  pass: boolean
  detail?: string
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const checks: CheckResult[] = []
  const now = Math.floor(Date.now() / 1000)

  // Env var checks
  const envChecks: Array<{ key: string; env: string; label_vi: string; label_en: string }> = [
    { key: 'heygen_key', env: 'HEYGEN_API_KEY', label_vi: 'Khóa HeyGen nền tảng', label_en: 'HeyGen platform key' },
    { key: 'resend_key', env: 'RESEND_API_KEY', label_vi: 'Khóa Resend', label_en: 'Resend platform key' },
    { key: 'nowpayments_ipn', env: 'NOWPAYMENTS_IPN_SECRET_KEY', label_vi: 'NOWPayments IPN secret', label_en: 'NOWPayments IPN secret' },
    { key: 'master_key', env: 'CREDENTIALS_MASTER_KEY', label_vi: 'CREDENTIALS_MASTER_KEY', label_en: 'CREDENTIALS_MASTER_KEY' },
    { key: 'cron_secret', env: 'CRON_SECRET', label_vi: 'CRON_SECRET', label_en: 'CRON_SECRET' },
  ]

  for (const c of envChecks) {
    checks.push({
      key: c.key,
      label_vi: c.label_vi,
      label_en: c.label_en,
      pass: !!process.env[c.env],
    })
  }

  // Cron last firing within 5 min
  try {
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');
    const lastCron = await db
      .prepare(`SELECT MAX(started_at) AS last_at FROM cron_run_log`)
      .first<{ last_at: number | null }>()
    const lastAt = lastCron?.last_at ?? 0
    const withinFiveMin = (now - lastAt) < 300
    checks.push({
      key: 'cron_firing',
      label_vi: 'Cron đã chạy trong 5 phút qua',
      label_en: 'Cron fired within last 5 min',
      pass: withinFiveMin,
      detail: lastAt ? `Last: ${new Date(lastAt * 1000).toISOString()}` : 'No cron run recorded',
    })

    // Synthetic success rate last 24h >= 95%
    const synthRow = await db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes
         FROM synthetic_monitor_results
         WHERE created_at >= ?1`,
      )
      .bind(now - 86400)
      .first<{ total: number; successes: number }>()

    const total = synthRow?.total ?? 0
    const successes = synthRow?.successes ?? 0
    const rate = total > 0 ? successes / total : 1
    checks.push({
      key: 'synthetic_rate',
      label_vi: 'Tỷ lệ thành công synthetic >= 95%',
      label_en: 'Synthetic success rate >= 95%',
      pass: total === 0 || rate >= 0.95,
      detail: total === 0 ? 'No runs in last 24h' : `${successes}/${total} (${Math.round(rate * 100)}%)`,
    })

    // Active customer count + last 24h purchases
    const custRow = await db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN paid_at >= ?1 THEN 1 ELSE 0 END) AS recent
         FROM user_purchases WHERE status = 'paid'`,
      )
      .bind(now - 86400)
      .first<{ total: number; recent: number }>()

    checks.push({
      key: 'customers',
      label_vi: 'Số khách hàng đang hoạt động',
      label_en: 'Active customers + last 24h purchases',
      pass: true, // informational only
      detail: `Total paid: ${custRow?.total ?? 0} | Last 24h: ${custRow?.recent ?? 0}`,
    })

    // HeyGen health (check via env presence — actual live check deferred to health endpoint)
    const heygenKey = process.env.HEYGEN_API_KEY
    checks.push({
      key: 'heygen_health',
      label_vi: 'HeyGen health (key set)',
      label_en: 'HeyGen health (key configured)',
      pass: !!heygenKey,
      detail: heygenKey ? 'Key configured — check /api/health/heygen for live status' : 'Key missing',
    })
  } catch {
    // partial checks possible if some tables missing
  }

  return NextResponse.json({ checks, timestamp: now })
}
