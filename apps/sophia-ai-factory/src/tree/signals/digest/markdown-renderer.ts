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
import { fmt, fmtUsd, tableRows, buildTldr } from './markdown-sections'

export { buildTldr }

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

/**
 * Render bilingual Markdown digest.
 * Sections: TL;DR, Signups, Conversions, Payments, BYOK Usage, Agent Activity.
 * PostHog summary appended if available.
 */
export function renderDigestMarkdown(data: DigestData): string {
  const lines: string[] = []

  lines.push(`# Báo Cáo Tín Hiệu Tuần / Weekly Metrics Digest`)
  lines.push(`**${data.weekLabel}** | Sophia AI Factory`)
  lines.push('')

  lines.push(`## TL;DR`)
  lines.push(buildTldr(data))
  lines.push('')

  lines.push(`## Đăng Ký Mới / New Signups`)
  lines.push(`> Tier conversions từ tầng miễn phí / conversions from free tier`)
  lines.push('')
  lines.push(`| Chỉ số / Metric | Giá trị / Value |`)
  lines.push(`|---|---|`)
  lines.push(tableRows([{ label: 'Tổng đăng ký mới / Total new signups', value: fmt(data.signups.count) }]))
  lines.push('')

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
