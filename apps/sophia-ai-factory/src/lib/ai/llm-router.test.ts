import { describe, it, expect } from 'vitest'
import {
  classifyComplexity,
  selectRoute,
  route,
  type Complexity,
} from './llm-router'

describe('llm-router.classifyComplexity', () => {
  it('classifies short greetings as simple', () => {
    expect(classifyComplexity('hello')).toBe('simple')
    expect(classifyComplexity('chào bạn')).toBe('simple')
    expect(classifyComplexity('what is Docker')).toBe('simple')
  })

  it('classifies 201-char prompts as medium by length', () => {
    const prompt = 'a'.repeat(201)
    expect(classifyComplexity(prompt)).toBe('medium')
  })

  it('classifies 501-char prompts as complex by length', () => {
    const prompt = 'b'.repeat(501)
    expect(classifyComplexity(prompt)).toBe('complex')
  })

  it('escalates to complex when 2+ complex keywords present', () => {
    expect(classifyComplexity('explain and analyze this code')).toBe('complex')
    expect(classifyComplexity('phân tích và thiết kế API')).toBe('complex')
  })

  it('classifies single complex keyword (no simple) as medium', () => {
    expect(classifyComplexity('explain OAuth')).toBe('medium')
    expect(classifyComplexity('design pattern')).toBe('medium')
  })

  it('prefers simple when both complex and simple keywords appear in short prompt', () => {
    // "what is" (simple) + "explain" (complex), length < 200 → simple wins via simpleScore>0 guard
    expect(classifyComplexity('what is explain')).toBe('simple')
  })

  it('is deterministic — same input always same output', () => {
    const a = classifyComplexity('Refactor this module for clarity')
    const b = classifyComplexity('Refactor this module for clarity')
    expect(a).toBe(b)
  })

  it('is case-insensitive', () => {
    expect(classifyComplexity('EXPLAIN AND ANALYZE')).toBe('complex')
    expect(classifyComplexity('Explain And Analyze')).toBe('complex')
  })
})

describe('llm-router.selectRoute', () => {
  const tiers: Complexity[] = ['simple', 'medium', 'complex']

  it.each(tiers)('routes %s to local-mekongd when hasLocalMode=true', (tier) => {
    const r = selectRoute(tier, true)
    expect(r.provider).toBe('local-mekongd')
    expect(r.complexity).toBe(tier)
    expect(r.reason).toBe(`byok-local:${tier}`)
    expect(r.model).toMatch(/^qwen3-/)
  })

  it('routes simple + no-local to openrouter/gpt-4o-mini', () => {
    expect(selectRoute('simple', false)).toMatchObject({
      provider: 'openrouter',
      model:    'gpt-4o-mini',
      reason:   'cloud:simple',
    })
  })

  it('routes medium + no-local to openrouter/gpt-4o-mini', () => {
    expect(selectRoute('medium', false)).toMatchObject({
      provider: 'openrouter',
      model:    'gpt-4o-mini',
    })
  })

  it('routes complex + no-local to anthropic/claude-sonnet-4-6', () => {
    expect(selectRoute('complex', false)).toMatchObject({
      provider: 'anthropic',
      model:    'claude-sonnet-4-6',
      reason:   'cloud:complex',
    })
  })

  it('picks distinct local models per tier', () => {
    const s = selectRoute('simple',  true).model
    const m = selectRoute('medium',  true).model
    const c = selectRoute('complex', true).model
    expect(new Set([s, m, c]).size).toBe(3)
  })
})

describe('llm-router.route (convenience)', () => {
  it('combines classify + select', () => {
    const r = route('hello', false)
    expect(r.complexity).toBe('simple')
    expect(r.provider).toBe('openrouter')
  })

  it('respects local-mode preference on complex prompts', () => {
    const r = route('explain and analyze this architecture in depth', true)
    expect(r.complexity).toBe('complex')
    expect(r.provider).toBe('local-mekongd')
    expect(r.model).toBe('qwen3-30b')
  })
})
