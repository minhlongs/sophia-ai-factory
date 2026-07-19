'use client'

import { Product } from './types'
import { GemBadge } from './gem-badge'
import { TrendingUp } from 'lucide-react'
import Image from 'next/image'
import { useLocale } from 'next-intl'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const locale = useLocale()
  const formattedPrice = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
  }).format(product.avg_earnings_usd || 0)

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/20">
      <div className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted border border-border/50">
              {product.thumbnail_url ? (
                <Image
                  src={product.thumbnail_url}
                  alt={product.title}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-xs text-muted-foreground"
                  role="img"
                  aria-label="No product image available"
                >
                  No Img
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium capitalize text-muted-foreground">
                  {product.network_id}
                </span>
                {product.is_hidden_gem && <GemBadge size="sm" />}
              </div>
              <h3 className="mt-2 line-clamp-1 text-base font-semibold leading-none tracking-tight">
                {product.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {product.description || "No description available."}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-muted-foreground">SPS</span>
              <span className={`text-xl font-bold ${
                (product.sps_score || 0) >= 80 ? 'text-emerald-400' :
                (product.sps_score || 0) >= 50 ? 'text-amber-400' : 'text-muted-foreground'
              }`}>
                {product.sps_score?.toFixed(0) || '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border/50 pt-4">
          <div className="flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-start">
            <p className="text-xs font-medium uppercase text-muted-foreground">Commission</p>
            <p className="mt-0.5 text-sm font-semibold">{formattedPrice}</p>
          </div>
          <div className="flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-start">
            <p className="text-xs font-medium uppercase text-muted-foreground">Metrics</p>
            <div className="mt-0.5 flex items-center gap-1 text-sm font-medium">
               {/* Placeholder for gravity/rank */}
               {/* We assume raw_metrics exists but it's JSON */}
               <span>{((product.raw_metrics as Record<string, unknown>)?.gravity as number | undefined)?.toFixed(0) || '-'} Grav</span>
            </div>
          </div>
          <div className="flex flex-col justify-center items-center sm:items-start pt-2 sm:pt-0">
             <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-1 rounded-full sm:bg-transparent sm:px-0 sm:py-0">
               <TrendingUp className="h-3 w-3" aria-hidden="true" />
               <span>High Velocity</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
