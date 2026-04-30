import { Metadata } from 'next'
import Link from 'next/link'
import { Search, TrendingUp, Star, ArrowRight, PackageOpen } from 'lucide-react'
import { createServerClient } from '@/lib/db/client'
import type { AffiliateOffer } from '@/app/api/affiliate-discovery/route'

export const metadata: Metadata = {
  title: 'Sophia Index — Khám Phá Sản Phẩm Liên Kết',
  description: 'Công cụ khám phá sản phẩm liên kết tiềm năng cao, được đánh giá bởi AI.',
}

async function fetchOffers(): Promise<AffiliateOffer[]> {
  try {
    const db = createServerClient()
    const result = await db
      .from('affiliate_offers_selected')
      .select('id, offer_name, network, commission_rate, created_at')
      .order('created_at', { ascending: false })
      .range(0, 49)
    return (result.data ?? []) as unknown as AffiliateOffer[]
  } catch {
    return []
  }
}

function formatCommission(rate: number | null): string {
  if (rate === null) return '—'
  return `${Math.round(rate * 100)}%`
}

export default async function AffiliateDiscoveryPage() {
  const offers = await fetchOffers()
  const hasOffers = offers.length > 0

  return (
    <div className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
      <div className="mb-8 border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
          Sophia Index
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Khám phá sản phẩm liên kết tiềm năng cao với công cụ chấm điểm AI.
        </p>
      </div>

      {hasOffers ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {offers.map((offer) => (
            <div key={offer.id} className="rounded-xl border border-border/40 bg-card/50 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{offer.offer_name}</h3>
                  <span className="text-xs text-muted-foreground capitalize">{offer.network}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {offer.network === 'clickbank' ? 'CB' : offer.network.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Hoa hồng:{' '}
                  <span className="text-foreground font-medium">
                    {formatCommission(offer.commission_rate)}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <TrendingUp className="w-3 h-3" />
                  Active
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card/30 p-12 text-center space-y-3 mb-8">
          <PackageOpen className="w-10 h-10 text-muted-foreground mx-auto" />
          <h2 className="text-base font-semibold text-foreground">Chưa có sản phẩm nào</h2>
          <p className="text-sm text-muted-foreground">
            No offers yet — check back soon.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 px-4 py-2 text-sm font-medium text-violet-400 hover:bg-violet-500/10 transition-colors"
          >
            Xem Bảng Giá <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* CTA */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-6 text-center space-y-3">
        <Search className="w-8 h-8 text-violet-400 mx-auto" />
        <h2 className="text-lg font-semibold text-foreground">Mở Khóa Sophia Index Đầy Đủ</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Đăng ký gói Growth trở lên để truy cập toàn bộ cơ sở dữ liệu sản phẩm liên kết,
          bộ lọc AI và chấm điểm SPS thời gian thực.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Xem Bảng Giá <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
