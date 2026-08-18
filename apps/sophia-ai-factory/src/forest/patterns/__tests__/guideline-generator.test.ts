/**
 * Unit tests for guideline-generator.ts
 *
 * Tests rule generation with and without an LLM. The template fallback
 * must always produce bilingual output; the LLM path must fall back
 * to templates on parse failure (never throw).
 */

import { describe, it, expect } from 'vitest'
import { generateRuleFromPattern } from '../guideline-generator'
import type { PlaybookPattern } from '@/seed/types/playbook-pattern'

const basePattern: PlaybookPattern = {
  id: 'pat_test_hook_curiosity',
  workspaceId: 'ws_test',
  featureKey: 'hook_type',
  featureValue: 'curiosity_gap',
  metric: 'ctr',
  avgMetric: 0.073,
  sampleSize: 42,
  confidence: 0.82,
  confidenceLevel: 'medium',
  source: 'experiment',
  detectedAt: 1_700_000_000_000,
}

describe('generateRuleFromPattern — template fallback (no LLM)', () => {
  it('produces a rule with both vi and en text', async () => {
    const rule = await generateRuleFromPattern(basePattern, 'tiktok', 'awareness')
    expect(rule.ruleVi).toBeTruthy()
    expect(rule.ruleEn).toBeTruthy()
    expect(rule.platform).toBe('tiktok')
    expect(rule.goal).toBe('awareness')
    expect(rule.patternId).toBe(basePattern.id)
  })

  it('carries confidence and sample size from the pattern', async () => {
    const rule = await generateRuleFromPattern(basePattern, 'tiktok', 'awareness')
    expect(rule.confidence).toBe(basePattern.confidence)
    expect(rule.sampleSize).toBe(basePattern.sampleSize)
  })

  it('does NOT auto-apply below 0.9 confidence', async () => {
    const rule = await generateRuleFromPattern(basePattern, 'tiktok', 'awareness')
    expect(rule.autoApply).toBe(false)
  })

  it('auto-applies when confidence >= 0.9 AND sample >= 10', async () => {
    const high: PlaybookPattern = { ...basePattern, confidence: 0.95, sampleSize: 50 }
    const rule = await generateRuleFromPattern(high, 'youtube', 'conversion')
    expect(rule.autoApply).toBe(true)
  })

  it('does NOT auto-apply when sample < 10 even at high confidence', async () => {
    const lowN: PlaybookPattern = { ...basePattern, confidence: 0.97, sampleSize: 8 }
    const rule = await generateRuleFromPattern(lowN, 'youtube', 'conversion')
    expect(rule.autoApply).toBe(false)
  })
})

describe('generateRuleFromPattern — LLM path', () => {
  it('uses LLM output when it returns valid JSON', async () => {
    const llm = async () => JSON.stringify({
      rule_vi: 'Dùng hook curiosity_gap trên TikTok',
      rule_en: 'Use curiosity_gap hooks on TikTok',
      rationale: 'higher CTR',
    })
    const rule = await generateRuleFromPattern(basePattern, 'tiktok', 'awareness', llm)
    expect(rule.ruleVi).toBe('Dùng hook curiosity_gap trên TikTok')
    expect(rule.ruleEn).toBe('Use curiosity_gap hooks on TikTok')
  })

  it('falls back to templates when LLM returns non-JSON', async () => {
    const llm = async () => 'not json at all'
    const rule = await generateRuleFromPattern(basePattern, 'tiktok', 'awareness', llm)
    expect(rule.ruleVi).toBeTruthy()
    expect(rule.ruleEn).toBeTruthy()
    expect(rule.ruleVi).toContain('curiosity_gap')
  })

  it('falls back to templates when LLM returns null', async () => {
    const llm = async () => null
    const rule = await generateRuleFromPattern(basePattern, 'tiktok', 'awareness', llm)
    expect(rule.ruleVi).toBeTruthy()
    expect(rule.ruleEn).toBeTruthy()
  })

  it('falls back to templates when LLM throws', async () => {
    const llm = async () => { throw new Error('LLM down') }
    const rule = await generateRuleFromPattern(basePattern, 'tiktok', 'awareness', llm)
    expect(rule.ruleVi).toBeTruthy()
    expect(rule.ruleEn).toBeTruthy()
  })
})