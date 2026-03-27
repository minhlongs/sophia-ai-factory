import dynamic from 'next/dynamic'
import { Metadata } from 'next'
import { Skeleton } from '@/components/ui/skeleton'

const DiscoveryDashboard = dynamic(
  () => import('@/components/discovery/dashboard').then(m => ({ default: m.DiscoveryDashboard })),
  {
    loading: () => (
      <div className="flex flex-col gap-6 lg:flex-row">
        <Skeleton className="w-full lg:w-64 h-80 rounded-xl" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    ),
  }
)

export const metadata: Metadata = {
  title: 'Sophia Index — Khám Phá Sản Phẩm Liên Kết',
  description: 'Công cụ khám phá sản phẩm liên kết tiềm năng cao, được đánh giá bởi AI.',
}

export default function AffiliateDiscoveryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Sophia Index</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Khám phá sản phẩm liên kết tiềm năng cao với công cụ chấm điểm AI của chúng tôi.
        </p>
      </div>

      <DiscoveryDashboard />
    </div>
  )
}
