import type { Provider } from '@/seed/ai/provider-interface'

export interface ResilientOpenRouterOptions {
  openRouterKey: string | null
  anthropicKey?: string
  enableFallback?: boolean
  model?: string
}

export interface MultiProviderResilientOptions {
  primary: {
    provider: Provider
    model?: string
  }
  fallback?: {
    provider: Provider
    model?: string
  }
  maxRetriesPerProvider?: number
  timeoutMs?: number
}
