/**
 * Tests for compliance HTML report template orchestrator.
 *
 * Thin wrapper composing styles + section builders. Pins the document
 * shell structure (DOCTYPE, title interpolation, section order).
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/tree/audit/report-html-styles', () => ({
  getReportStyles: () => '/* test-styles */',
}))

vi.mock('@/tree/audit/report-html-sections', () => ({
  buildReportSections: () => ({
    header: '<!-- HEADER -->',
    summarySection: '<!-- SUMMARY -->',
    hashChainSection: '<!-- HASHCHAIN -->',
    licenseSection: '<!-- LICENSE -->',
    modelSection: '<!-- MODEL -->',
    footer: '<!-- FOOTER -->',
  }),
}))

import { generateComplianceHTML } from './report-html-template'
import type { ComplianceReportData } from './report-types'

const baseData = { reportId: 'rep-xyz-123' } as unknown as ComplianceReportData

describe('generateComplianceHTML', () => {
  it('starts with HTML5 DOCTYPE', () => {
    expect(generateComplianceHTML(baseData).startsWith('<!DOCTYPE html>')).toBe(true)
  })

  it('declares lang="en" on html element', () => {
    expect(generateComplianceHTML(baseData)).toContain('<html lang="en">')
  })

  it('includes UTF-8 charset + responsive viewport', () => {
    const html = generateComplianceHTML(baseData)
    expect(html).toContain('<meta charset="UTF-8">')
    expect(html).toContain('width=device-width')
  })

  it('interpolates reportId into title', () => {
    expect(generateComplianceHTML(baseData)).toContain(
      '<title>Compliance Report - rep-xyz-123</title>',
    )
  })

  it('embeds styles from getReportStyles inside <style> block', () => {
    expect(generateComplianceHTML(baseData)).toContain('<style>/* test-styles */</style>')
  })

  it('wraps sections in .container div', () => {
    expect(generateComplianceHTML(baseData)).toContain('<div class="container">')
  })

  it('renders sections in canonical order: header → summary → hashchain → license → model → footer', () => {
    const html = generateComplianceHTML(baseData)
    const positions = {
      header: html.indexOf('<!-- HEADER -->'),
      summary: html.indexOf('<!-- SUMMARY -->'),
      hashchain: html.indexOf('<!-- HASHCHAIN -->'),
      license: html.indexOf('<!-- LICENSE -->'),
      model: html.indexOf('<!-- MODEL -->'),
      footer: html.indexOf('<!-- FOOTER -->'),
    }
    expect(positions.header).toBeGreaterThan(0)
    expect(positions.summary).toBeGreaterThan(positions.header)
    expect(positions.hashchain).toBeGreaterThan(positions.summary)
    expect(positions.license).toBeGreaterThan(positions.hashchain)
    expect(positions.model).toBeGreaterThan(positions.license)
    expect(positions.footer).toBeGreaterThan(positions.model)
  })

  it('closes html/body tags (valid document)', () => {
    const html = generateComplianceHTML(baseData)
    expect(html.endsWith('</html>')).toBe(true)
    expect(html).toContain('</body>')
  })
})
