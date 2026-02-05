import { DiscoveryDashboard } from '@/components/discovery/dashboard'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sophia Index - Affiliate Discovery',
  description: 'AI-powered affiliate product discovery engine.',
}

export default function AffiliateDiscoveryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Sophia Index</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Discover high-potential affiliate products with our AI scoring engine.
        </p>
      </div>

      <DiscoveryDashboard />
    </div>
  )
}
