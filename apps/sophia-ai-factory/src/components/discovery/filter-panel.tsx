'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { DiscoveryFilters } from './types'

interface FilterPanelProps {
  filters: DiscoveryFilters
  onFilterChange: (filters: DiscoveryFilters) => void
  categories?: { id: number; name: string }[]
}

export function FilterPanel({ filters, onFilterChange, categories = [] }: FilterPanelProps) {
  const [localSearch, setLocalSearch] = useState(filters.q || '')

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onFilterChange({ ...filters, q: localSearch })
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-border/50">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Filters</h3>
      </div>

      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search products..."
          className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />
      </form>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <select
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filters.category || ''}
            onChange={(e) => onFilterChange({ ...filters, category: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Hidden Gems Only</label>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
            checked={filters.hiddenGemsOnly || false}
            onChange={(e) => onFilterChange({ ...filters, hiddenGemsOnly: e.target.checked })}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Min SPS Score: {filters.minSps || 0}</label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
            value={filters.minSps || 0}
            onChange={(e) => onFilterChange({ ...filters, minSps: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  )
}
