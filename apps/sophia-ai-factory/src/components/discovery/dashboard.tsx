'use client'

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { FilterPanel } from './filter-panel'
import { ProductCard } from './product-card'
import { DiscoveryFilters, Product } from './types'
import { Loader2 } from 'lucide-react'

export function DiscoveryDashboard() {
  const [filters, setFilters] = useState<DiscoveryFilters>({
    hiddenGemsOnly: false,
    minSps: 0,
    sort: 'sps_score'
  })

  // Fetch Top 50 / Search Results
  const { data, isLoading, error } = useQuery({
    queryKey: ['discovery', filters],
    queryFn: async () => {
      // Build query string
      const params = new URLSearchParams()
      if (filters.q) params.append('q', filters.q)
      if (filters.category) params.append('category', filters.category.toString())
      if (filters.hiddenGemsOnly) params.append('hidden_gems', 'true')

      // Choose endpoint
      const endpoint = filters.q
        ? `/api/discovery/search?${params.toString()}`
        : `/api/discovery/top-50?${params.toString()}`

      const res = await fetch(endpoint)
      if (!res.ok) throw new Error('Failed to fetch data')
      return res.json() as Promise<{ data: Product[], count?: number }>
    },
    placeholderData: keepPreviousData
  })

  // Client-side filtering for Min SPS (since API might return broader set for caching)
  const products = (data?.data || []).filter(p => {
    if (filters.minSps && (p.sps_score || 0) < filters.minSps) return false
    return true
  })

  // Placeholder categories - In real app, fetch from /api/categories
  const categories = [
    { id: 1, name: 'Health & Fitness' },
    { id: 2, name: 'Wealth & Finance' },
    { id: 3, name: 'Relationships' },
    { id: 4, name: 'Technology' },
  ]

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full lg:w-64 flex-shrink-0">
        <FilterPanel
          filters={filters}
          onFilterChange={setFilters}
          categories={categories}
        />
      </aside>

      <main className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {filters.q ? 'Search Results' : 'Top Opportunities'}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({products.length} found)
            </span>
          </h2>
          {/* Sorting controls could go here */}
        </div>

        {isLoading ? (
          <div className="flex h-64 w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            Error loading data. Please try again.
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-64 w-full flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            <p>No products found matching your criteria.</p>
            <button
              onClick={() => setFilters({})}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
