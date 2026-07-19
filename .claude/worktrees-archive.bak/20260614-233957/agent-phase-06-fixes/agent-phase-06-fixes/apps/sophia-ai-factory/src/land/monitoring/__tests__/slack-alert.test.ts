/**
 * Unit tests for slack-alert.ts
 * Tests: successful POST, missing webhook fallback, error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendSlackAlert } from '../slack-alert'

describe('sendSlackAlert', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SLACK_OPS_WEBHOOK_URL = 'https://hooks.slack.com/test/webhook'
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.SLACK_OPS_WEBHOOK_URL
  })

  it('POSTs to the Slack webhook URL on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    global.fetch = mockFetch as typeof fetch

    await sendSlackAlert('high', 'Test alert message', { key: 'value' })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://hooks.slack.com/test/webhook')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body as string)
    expect(body.text).toContain('HIGH')
    expect(body.text).toContain('Test alert message')
  })

  it('does not throw when SLACK_OPS_WEBHOOK_URL is missing', async () => {
    delete process.env.SLACK_OPS_WEBHOOK_URL
    const mockFetch = vi.fn()
    global.fetch = mockFetch as typeof fetch

    await expect(sendSlackAlert('high', 'no webhook')).resolves.toBeUndefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not throw when fetch throws (network error)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'))
    global.fetch = mockFetch as typeof fetch

    await expect(sendSlackAlert('medium', 'fetch failure')).resolves.toBeUndefined()
  })

  it('does not throw when Slack returns non-OK status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    global.fetch = mockFetch as typeof fetch

    await expect(sendSlackAlert('low', 'non-ok response')).resolves.toBeUndefined()
  })

  it('includes context fields in attachment when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    global.fetch = mockFetch as typeof fetch

    await sendSlackAlert('high', 'with context', { purchaseId: 'p-123', ageMinutes: 15 })

    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string)
    const fields = body.attachments?.[0]?.fields
    expect(fields).toBeDefined()
    const titles = fields.map((f: { title: string }) => f.title)
    expect(titles).toContain('purchaseId')
    expect(titles).toContain('ageMinutes')
  })
})
