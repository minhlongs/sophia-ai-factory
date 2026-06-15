import { Metadata } from "next";
import { LayoutDashboard, PlusCircle, ListVideo, BarChart3, Settings, Key, CreditCard, Search } from "lucide-react";
import { GuideFeatureGrid, GuideFeatureItem } from "@/forest/components/guide/guide-feature-grid";
import { GuideCallout } from "@/forest/components/guide/guide-callout";
import { buildBreadcrumbSchema } from "@/land/seo/schema-org";

const SITE_URL = 'https://sophia.agencyos.network';
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: SITE_URL },
  { name: 'Guide', url: `${SITE_URL}/guide` },
  { name: 'Screens', url: `${SITE_URL}/guide/screens` },
]);

export const metadata: Metadata = {
  title: "Hướng Dẫn Màn Hình A-Z — Hướng Dẫn Sophia AI Factory",
  description: "Hướng dẫn đầy đủ từng màn hình trong Sophia AI Video Factory",
};

const dashboardFeatures: GuideFeatureItem[] = [
  {
    icon: LayoutDashboard,
    title: "Dashboard Tổng Quan",
    description: "Xem nhanh tổng số video, chiến dịch đang chạy, và tỷ lệ hoàn thành. URL: /dashboard",
    iconColor: "text-primary-400",
  },
  {
    icon: PlusCircle,
    title: "Tạo Chiến Dịch",
    description: "Tạo video mới bằng cách chọn mẫu, nhập nội dung và giọng nói. URL: /dashboard/create",
    iconColor: "text-accent-400",
  },
  {
    icon: ListVideo,
    title: "Danh Sách Chiến Dịch",
    description: "Quản lý tất cả video đã tạo: xem, tải về, hoặc chạy lại. URL: /dashboard/campaigns",
    iconColor: "text-blue-400",
  },
  {
    icon: BarChart3,
    title: "Thống Kê & Analytics",
    description: "Biểu đồ số video theo thời gian, tỷ lệ thành công, và hiệu suất. URL: /dashboard/analytics",
    iconColor: "text-emerald-400",
  },
  {
    icon: Key,
    title: "API Keys",
    description: "Quản lý keys cho OpenRouter, ElevenLabs và D-ID. Chỉ nhập 1 lần. URL: /dashboard/settings",
    iconColor: "text-amber-400",
  },
  {
    icon: CreditCard,
    title: "Thanh Toán & Gói",
    description: "Xem gói hiện tại, nâng cấp, và tải lịch sử hóa đơn. URL: /dashboard/settings",
    iconColor: "text-rose-400",
  },
];

const pageSummary = [
  { url: "/", name: "Trang Chủ", desc: "Giới thiệu tính năng, bảng giá, và đăng ký" },
  { url: "/pricing", name: "Bảng Giá", desc: "So sánh 4 gói: Starter, Growth, Premium, Master" },
  { url: "/dashboard/onboarding", name: "Thiết Lập", desc: "Trình hướng dẫn 4 bước nhập API Keys" },
  { url: "/dashboard", name: "Dashboard", desc: "Trung tâm điều khiển chính" },
  { url: "/dashboard/create", name: "Tạo Chiến Dịch", desc: "Form tạo video mới" },
  { url: "/dashboard/campaigns", name: "Chiến Dịch", desc: "Danh sách tất cả video" },
  { url: "/dashboard/analytics", name: "Thống Kê", desc: "Biểu đồ hiệu suất" },
  { url: "/dashboard/settings", name: "Cài Đặt", desc: "API Keys, gói, tài khoản" },
  { url: "/affiliate-discovery", name: "Tìm Sản Phẩm", desc: "AI chấm điểm sản phẩm bán chạy" },
];

export default function ScreensGuidePage() {
  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Hướng Dẫn Màn Hình A-Z
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Tổng quan từng màn hình trong Sophia — biết đâu để làm gì.
        </p>
      </div>

      {/* Feature grid */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Các Tính Năng Chính</h2>
        <GuideFeatureGrid features={dashboardFeatures} columns={2} />
      </div>

      <GuideCallout variant="tip" title="Màu trạng thái">
        Vàng = Đang xử lý &nbsp;|&nbsp; Xanh lá = Hoàn thành &nbsp;|&nbsp; Đỏ = Có lỗi (nhấn Retry để thử lại)
      </GuideCallout>

      {/* Page index */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-accent-400" aria-hidden="true" />
          Bản Đồ Trang
        </h2>
        <div className="border border-border/40 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_1fr] bg-muted/30 px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 gap-4">
            <span>#</span>
            <span>Tên Trang</span>
            <span>Mô Tả</span>
          </div>
          {pageSummary.map((page, i) => (
            <div
              key={page.url}
              className="grid grid-cols-[auto_1fr_1fr] px-5 py-3 text-sm border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors gap-4 items-start"
            >
              <span className="text-muted-foreground/50 text-xs font-mono w-4">{i + 1}</span>
              <div>
                <div className="font-medium text-foreground">{page.name}</div>
                <div className="font-mono text-xs text-muted-foreground/60 mt-0.5">{page.url}</div>
              </div>
              <span className="text-muted-foreground text-xs leading-relaxed">{page.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing tiers */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Giới Hạn Theo Gói</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { name: "Starter", price: "$199/tháng", limit: "10 chiến dịch/tháng", color: "border-border/40" },
            { name: "Growth", price: "$399/tháng", limit: "50 chiến dịch/tháng", color: "border-primary-500/40" },
            { name: "Premium", price: "$799/tháng", limit: "Không giới hạn", color: "border-accent-500/40" },
            { name: "Master", price: "$4,999 (trọn đời)", limit: "Không giới hạn", color: "border-amber-500/40" },
          ].map((tier) => (
            <div key={tier.name} className={`bg-card/50 border ${tier.color} rounded-xl p-4`}>
              <div className="text-xs font-bold text-muted-foreground mb-1">{tier.name}</div>
              <div className="text-sm font-semibold text-foreground">{tier.price}</div>
              <div className="text-xs text-muted-foreground mt-1">{tier.limit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
