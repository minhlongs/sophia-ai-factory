'use client'

import { useState, useEffect } from 'react'

export default function IntegrationsPage() {
  const [clickbankKey, setClickbankKey] = useState('')
  const [shareasaleToken, setShareasaleToken] = useState('')
  const [shareasaleSecret, setShareasaleSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch existing integrations status
    async function fetchIntegrations() {
      try {
        const response = await fetch('/api/user/integrations')
        if (response.ok) {
          await response.json()
          // Keys not returned for security; user can overwrite existing values
        }
      } catch {
      } finally {
        setLoading(false)
      }
    }
    fetchIntegrations()
  }, [])

  async function handleSave(network: 'clickbank' | 'shareasale') {
    setSaving(true)
    try {
      const payload = network === 'clickbank'
        ? { network: 'clickbank', api_key: clickbankKey }
        : { network: 'shareasale', api_key: shareasaleToken, api_secret: shareasaleSecret }

      const response = await fetch('/api/user/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) throw new Error('Failed to save')
      alert('Integration saved!')
      if (network === 'clickbank') setClickbankKey('')
      if (network === 'shareasale') {
        setShareasaleToken('')
        setShareasaleSecret('')
      }
    } catch {
      alert('Error saving integration')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8">Loading settings...</div>

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8 text-foreground">Affiliate Network Integrations</h1>

      {/* ClickBank */}
      <div className="mb-8 p-6 border border-border rounded-lg bg-card shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-foreground">ClickBank</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your ClickBank API Key to sync sales data.
        </p>
        <label htmlFor="clickbank-key" className="sr-only">ClickBank API Key</label>
        <input
          id="clickbank-key"
          type="text"
          placeholder="API Key"
          value={clickbankKey}
          onChange={(e) => setClickbankKey(e.target.value)}
          className="w-full px-4 py-2 border border-input bg-background rounded mb-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
        />
        <button
          onClick={() => handleSave('clickbank')}
          disabled={saving || !clickbankKey}
          className="px-6 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {saving ? 'Saving...' : 'Save ClickBank Key'}
        </button>
      </div>

      {/* ShareASale */}
      <div className="p-6 border border-border rounded-lg bg-card shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-foreground">ShareASale</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your ShareASale API Token and Secret.
        </p>
        <label htmlFor="shareasale-token" className="sr-only">ShareASale API Token</label>
        <input
          id="shareasale-token"
          type="text"
          placeholder="API Token"
          value={shareasaleToken}
          onChange={(e) => setShareasaleToken(e.target.value)}
          className="w-full px-4 py-2 border border-input bg-background rounded mb-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
        />
        <label htmlFor="shareasale-secret" className="sr-only">ShareASale API Secret</label>
        <input
          id="shareasale-secret"
          type="password"
          placeholder="API Secret"
          value={shareasaleSecret}
          onChange={(e) => setShareasaleSecret(e.target.value)}
          className="w-full px-4 py-2 border border-input bg-background rounded mb-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
        />
        <button
          onClick={() => handleSave('shareasale')}
          disabled={saving || !shareasaleToken || !shareasaleSecret}
          className="px-6 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {saving ? 'Saving...' : 'Save ShareASale Keys'}
        </button>
      </div>
    </div>
  )
}
