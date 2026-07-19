/**
 * Tests for handover doc generator.
 *
 * Pure function — produces Markdown onboarding document for new agency
 * customers. Tests pin the input→output contract: every field reaches the
 * doc, tier-specific catalog values are interpolated, and section structure
 * is preserved (cover/account/tier/sops/setup/support/faq/contract).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateHandoverDoc, type HandoverDocInput } from './handover-doc-generator'
import { TIER_MCU_LIMITS } from './handover-types'
import {
  TIER_PRICES,
  TIER_BILLING_TERMS,
  TIER_FEATURES,
  TIER_SUPPORT_SLA,
  TIER_CONCURRENT_RUNS,
} from './handover-tier-content'

const FIXED_NOW = new Date('2026-05-11T12:00:00Z')

const baseInput: HandoverDocInput = {
  customerId: 'cust-abc-123',
  agencyName: 'Acme Agency',
  ownerFullName: 'Jane Doe',
  ownerEmail: 'jane@acme.example',
  tier: 'PREMIUM',
  agencyType: 'b2b_saas',
  locale: 'en',
  installedSops: ['sop-lead-gen', 'sop-email-blast'],
  magicLinkUrl: 'https://sophia.example/magic/abc123',
  contractDate: '2026-05-01',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('generateHandoverDoc — cover section', () => {
  it('includes agency name, owner, email, tier, customer ID, contract date', () => {
    const doc = generateHandoverDoc(baseInput)

    expect(doc).toContain('**Acme Agency**')
    expect(doc).toContain('Jane Doe')
    expect(doc).toContain('jane@acme.example')
    expect(doc).toContain('**PREMIUM**')
    expect(doc).toContain('`cust-abc-123`')
    expect(doc).toContain('2026-05-01')
  })

  it('includes tier price from TIER_PRICES catalog', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain(TIER_PRICES.PREMIUM)
  })

  it('stamps document date as ISO YYYY-MM-DD (split from new Date)', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain('2026-05-11')
  })
})

describe('generateHandoverDoc — account section', () => {
  it('includes magic link URL verbatim', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain('https://sophia.example/magic/abc123')
  })

  it('mentions 24h expiry on magic link', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toMatch(/24h|24 hours/i)
  })

  it('includes login URL', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain('https://sophia.agencyos.network/login')
  })
})

describe('generateHandoverDoc — tier section', () => {
  it('formats MCU limit with locale separators (toLocaleString)', () => {
    const doc = generateHandoverDoc(baseInput)
    // PREMIUM = 5000 → "5,000"
    expect(doc).toContain(TIER_MCU_LIMITS.PREMIUM.toLocaleString())
    expect(doc).toMatch(/5,000\s+MCU/)
  })

  it('lists every feature from TIER_FEATURES catalog', () => {
    const doc = generateHandoverDoc(baseInput)
    for (const feature of TIER_FEATURES.PREMIUM) {
      expect(doc).toContain(feature)
    }
  })

  it.each(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const)(
    'interpolates correct MCU + features for tier %s',
    (tier) => {
      const doc = generateHandoverDoc({ ...baseInput, tier })
      expect(doc).toContain(TIER_MCU_LIMITS[tier].toLocaleString())
      expect(doc).toContain(TIER_FEATURES[tier][0])
      expect(doc).toContain(TIER_PRICES[tier])
    }
  )
})

describe('generateHandoverDoc — SOPs section', () => {
  it('numbers installed SOPs starting at 1 with backtick code formatting', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain('1. `sop-lead-gen`')
    expect(doc).toContain('2. `sop-email-blast`')
  })

  it('preserves installed SOPs in declared order', () => {
    const doc = generateHandoverDoc(baseInput)
    const idx1 = doc.indexOf('sop-lead-gen')
    const idx2 = doc.indexOf('sop-email-blast')
    expect(idx1).toBeGreaterThan(0)
    expect(idx2).toBeGreaterThan(idx1)
  })

  it('renders placeholder for empty installedSops', () => {
    const doc = generateHandoverDoc({ ...baseInput, installedSops: [] })
    expect(doc).toContain('_No SOPs pre-installed')
    expect(doc).not.toMatch(/^\d\. `sop-/m)
  })

  it('notes that pre-installed SOPs require API keys before running', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toMatch(/require your API keys/i)
  })
})

describe('generateHandoverDoc — setup section', () => {
  it('includes 8 numbered setup steps (Step 1..Step 8)', () => {
    const doc = generateHandoverDoc(baseInput)
    for (let i = 1; i <= 8; i++) {
      expect(doc).toContain(`Step ${i}`)
    }
  })

  it('references HeyGen, Resend, NOWPayments setup pages', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain('https://heygen.com')
    expect(doc).toContain('https://resend.com')
    expect(doc).toContain('https://nowpayments.io')
  })
})

describe('generateHandoverDoc — support + FAQ section', () => {
  it('shows tier-specific SLA from TIER_SUPPORT_SLA', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain(TIER_SUPPORT_SLA.PREMIUM)
  })

  it('shows tier-specific concurrent-runs label from TIER_CONCURRENT_RUNS', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain(TIER_CONCURRENT_RUNS.PREMIUM)
  })

  it('mentions @Sophia_Bbot Telegram support channel (PROTECTED FLOW)', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain('@Sophia_Bbot')
  })

  it('references support email', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain('support@mekongmind.com')
  })

  it('contains BYOK FAQ entry', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toMatch(/BYOK/)
  })
})

describe('generateHandoverDoc — contract + footer', () => {
  it('lists tier + price + contract date + customer ID', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain(`**Tier:** PREMIUM — ${TIER_PRICES.PREMIUM}`)
    expect(doc).toContain('**Contract Date:** 2026-05-01')
    expect(doc).toContain(`**Billing:** ${TIER_BILLING_TERMS.PREMIUM}`)
    expect(doc).toContain('`cust-abc-123`')
  })

  it('uses one-time billing for MASTER contracts', () => {
    const doc = generateHandoverDoc({ ...baseInput, tier: 'MASTER' })
    expect(doc).toContain(`**Tier:** MASTER — ${TIER_PRICES.MASTER}`)
    expect(doc).toContain(`**Billing:** ${TIER_BILLING_TERMS.MASTER}`)
    expect(doc).not.toContain('**Billing:** Monthly, auto-renew')
  })

  it('footer includes generation timestamp + secure-doc warning', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).toContain('Document generated by Sophia AI Factory')
    expect(doc).toContain(FIXED_NOW.toISOString())
    expect(doc).toMatch(/Keep this document secure/i)
  })
})

describe('generateHandoverDoc — structure', () => {
  it('starts with H1 Welcome heading', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc.startsWith('# Welcome to Sophia AI')).toBe(true)
  })

  it('contains all 8 H2 section headers', () => {
    const doc = generateHandoverDoc(baseInput)
    for (const heading of [
      '## Cover',
      '## Account Access',
      '## Your Tier:',
      '## Pre-Installed SOPs',
      '## Required Setup Steps',
      '## Support',
      '## FAQ',
      '## Contract Details',
    ]) {
      expect(doc).toContain(heading)
    }
  })

  it('escapes nothing — output is plain Markdown ready to copy-paste', () => {
    const doc = generateHandoverDoc(baseInput)
    expect(doc).not.toContain('\\n')
    expect(doc.length).toBeGreaterThan(500)
  })
})
