/**
 * Weekly Metrics Digest — Markdown Formatting Helpers & TL;DR Builder
 *
 * @module tree/signals/digest/markdown-sections
 */

import type { DigestData } from './markdown-renderer'

export function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

export function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

export function tableRows(rows: Array<{ label: string; value: string | number }>): string {
  if (rows.length === 0) return '_Không có dữ liệu / No data_\n'
  return rows.map((r) => `| ${r.label} | ${r.value} |`).join('\n') + '\n'
}

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
