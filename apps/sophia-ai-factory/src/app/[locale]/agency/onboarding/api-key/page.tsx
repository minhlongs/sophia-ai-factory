'use client'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Check, Copy, AlertTriangle } from 'lucide-react'

export default function AgencyApiKeyPage() {
  const params = useSearchParams()
  const apiKey = params.get('key') ?? ''
  const [copied, setCopied] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (!apiKey || dismissed) {
    return <div className="max-w-lg mx-auto py-12 px-4 text-center"><p className="text-muted-foreground">No API key found. Please complete step 1.</p></div>
  }

  async function copyKey() {
    try { await navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 mb-8">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Save this key now</p>
          <p className="text-sm text-amber-700 mt-1">API key is shown ONCE. Cannot be recovered after leaving this page.</p>
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-2">Your API Key</h1>
      <p className="text-muted-foreground mb-6">Copy and save it in a safe place</p>
      <div className="flex items-center gap-3">
        <code className="flex-1 rounded-md border bg-muted px-4 py-3 text-sm font-mono break-all select-all">{apiKey}</code>
        <button onClick={copyKey} className="shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-muted" title="Copy">
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <button onClick={() => setDismissed(true)} className="mt-8 text-sm text-muted-foreground underline">I've saved it — continue to dashboard</button>
    </div>
  )
}
