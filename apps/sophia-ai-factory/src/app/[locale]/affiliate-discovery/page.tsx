import { Metadata } from 'next'
import Link from 'next/link'
import { Search, TrendingUp, Star, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sophia Index — Khám Phá Sản Phẩm Liên Kết',
  description: 'Công cụ khám phá sản phẩm liên kết tiềm năng cao, được đánh giá bởi AI.',
}

const DEMO_PRODUCTS = [
  { name: "AI Video Editor Pro", category: "SaaS", score: 92, commission: "30%", trend: "up" },
  { name: "Content Planner AI", category: "Marketing", score: 88, commission: "25%", trend: "up" },
  { name: "Social Media Autopilot", category: "Automation", score: 85, commission: "20%", trend: "stable" },
  { name: "SEO Research Tool", category: "Marketing", score: 82, commission: "35%", trend: "up" },
  { name: "Email Campaign Studio", category: "SaaS", score: 79, commission: "22%", trend: "stable" },
  { name: "Landing Page Builder", category: "Design", score: 76, commission: "28%", trend: "up" },
]

export default function AffiliateDiscoveryPage() {
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

      {/* Demo Product Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {DEMO_PRODUCTS.map((product) => (
          <div key={product.name} className="rounded-xl border border-border/40 bg-card/50 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground text-sm">{product.name}</h3>
                <span className="text-xs text-muted-foreground">{product.category}</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                {product.score}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Hoa hồng: <span className="text-foreground font-medium">{product.commission}</span></span>
              <span className="flex items-center gap-1 text-emerald-400">
                <TrendingUp className="w-3 h-3" />
                {product.trend === "up" ? "Tăng" : "Ổn định"}
              </span>
            </div>
          </div>
        ))}
      </div>

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
