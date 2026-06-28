/**
 * Weekly Metrics Digest — Bilingual Markdown Renderer (VN + EN)
 *
 * Takes aggregate results from d1-aggregates.ts and produces a bilingual
 * Markdown string suitable for GitHub Issue body and email.
 *
 * SECURITY: inputs are already aggregated counts — no PII in output.
 */

import type {
  SignupStats,
  ConversionRow,
  PaymentStats,
  ByokProviderRow,
  AgentDispatchRow,
} from './d1-aggregates'

export interface DigestData {
  weekLabel: string   // e.g. "Week 16 (2026-04-17)"
  signups: SignupStats
  conversions: ConversionRow[]
  payments: PaymentStats
  byokProviders: ByokProviderRow[]
  agentDispatches: AgentDispatchRow[]
  /** Optional AI-generated PostHog summary (existing path) */
  posthogSummary?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

function tableRows(rows: Array<{ label: string; value: string | number }>): string {
  if (rows.length === 0) return '_Không có dữ liệu / No data_\n'
  return rows.map((r) => `| ${r.label} | ${r.value} |`).join('\n') + '\n'
}

// ── TL;DR builder (≤ 280 chars — fits a Telegram opening line) ────────────────

export function buildTldr(data: DigestData): string {
  const { signups, payments, conversions } = data
  const topTier = conversions[0]?.to_tier ?? 'N/A'
  return (
    `📊 ${data.weekLabel}: ` +
    `${fmt(signups.count)} new signups, ` +
    `${fmt(payments.success_count)} payments (${fmtUsd(payments.total_usd)}), ` +
    `${fmt(payments.failed_count)} failed, ` +
    `top tier → ${topTier}`
  )
}

// ── Full Markdown renderer ────────────────────────────────────────────────────

/**
 * Render bilingual Markdown digest.
 * Sections: TL;DR, Signups, Conversions, Payments, BYOK Usage, Agent Activity.
 * PostHog summary appended if available.
 */
export function renderDigestMarkdown(data: DigestData): string {
  const lines: string[] = []

  // Header
  lines.push(`# Báo Cáo Tín Hiệu Tuần / Weekly Metrics Digest`)
  lines.push(`**${data.weekLabel}** | Sophia AI Factory`)
  lines.push('')

  // TL;DR
  lines.push(`## TL;DR`)
  lines.push(buildTldr(data))
  lines.push('')

  // Signups
  lines.push(`## Đăng Ký Mới / New Signups`)
  lines.push(`> Tier conversions từ tầng miễn phí / conversions from free tier`)
  lines.push('')
  lines.push(`| Chỉ số / Metric | Giá trị / Value |`)
  lines.push(`|---|---|`)
  lines.push(tableRows([{ label: 'Tổng đăng ký mới / Total new signups', value: fmt(data.signups.count) }]))
  lines.push('')

  // Conversions
  lines.push(`## Chuyển Đổi Gói / Tier Conversions`)
  lines.push(`| Gói đích / Target Tier | Lượt chuyển / Conversions |`)
  lines.push(`|---|---|`)
  if (data.conversions.length === 0) {
    lines.push(`| _Không có / None_ | — |`)
  } else {
    for (const row of data.conversions) {
      lines.push(`| ${row.to_tier} | ${fmt(row.count)} |`)
    }
  }
  lines.push('')

  // Payments
  lines.push(`## Thanh Toán / Payments`)
  lines.push(`| Chỉ số / Metric | Giá trị / Value |`)
  lines.push(`|---|---|`)
  lines.push(
    tableRows([
      { label: 'Thanh toán thành công / Successful', value: fmt(data.payments.success_count) },
      { label: 'Thanh toán thất bại / Failed', value: fmt(data.payments.failed_count) },
      { label: 'Tổng doanh thu / Total revenue', value: fmtUsd(data.payments.total_usd) },
    ]),
  )
  lines.push('')

  // BYOK Usage
  lines.push(`## Sử Dụng BYOK / BYOK Usage`)
  lines.push(`> Lượt gọi tới nhà cung cấp AI theo tuần / Weekly calls to AI providers`)
  lines.push('')
  lines.push(`| Nhà cung cấp / Provider | Lượt gọi / Calls |`)
  lines.push(`|---|---|`)
  if (data.byokProviders.length === 0) {
    lines.push(`| _Không có / None_ | — |`)
  } else {
    for (const row of data.byokProviders) {
      lines.push(`| ${row.provider} | ${fmt(row.call_count)} |`)
    }
  }
  lines.push('')

  // Agent Activity
  lines.push(`## Hoạt Động Agent / Agent Activity`)
  lines.push(`> Số lần dispatch agent theo chiến dịch / Agent dispatches by campaign`)
  lines.push('')
  lines.push(`| Lệnh / Command | Tổng kênh / Total Channels |`)
  lines.push(`|---|---|`)
  if (data.agentDispatches.length === 0) {
    lines.push(`| _Không có / None_ | — |`)
  } else {
    for (const row of data.agentDispatches) {
      lines.push(`| ${row.command} | ${fmt(row.dispatch_count)} |`)
    }
  }
  lines.push('')

  // PostHog enrichment (optional)
  if (data.posthogSummary) {
    lines.push(`## Phân Tích PostHog / PostHog Insights`)
    lines.push(`> AI-generated analysis từ PostHog events`)
    lines.push('')
    lines.push(data.posthogSummary)
    lines.push('')
  }

  lines.push(`---`)
  lines.push(`_Tự động tạo lúc ${new Date().toISOString()} / Auto-generated_`)

  return lines.join('\n')
}
