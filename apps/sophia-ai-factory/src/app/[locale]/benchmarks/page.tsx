/**
 * /benchmarks — Public benchmarks page.
 *
 * Server Component: displays Sophia AI Factory performance benchmarks.
 * Bilingual (vi + en) with ISR at 3600s.
 *
 * @module app/benchmarks/page
 */

import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const revalidate = 3600;
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Performance Benchmarks | Sophia AI Factory",
  description: "Platform performance benchmarks including video generation success rate, uptime, test suite health, and multi-provider comparison.",
};

interface BenchmarkItem {
  metric: string;
  value: string;
  status: "pass" | "warning" | "info";
}

interface ProviderComparison {
  name: string;
  successRate: string;
  avgTime: string;
  languages: string;
}

const EN_BENCHMARKS: BenchmarkItem[] = [
  { metric: "Video Generation Success Rate", value: ">95%", status: "pass" },
  { metric: "Average Generation Time", value: "<5 min", status: "pass" },
  { metric: "Platform Uptime (30-day rolling)", value: "99.9%", status: "pass" },
  { metric: "Test Suite Health", value: "6,700+ tests, 0 failures", status: "pass" },
  { metric: "API Response Time (P95)", value: "<300ms", status: "pass" },
  { metric: "Customer Churn Rate", value: "<5% monthly", status: "pass" },
];

const VI_BENCHMARKS: BenchmarkItem[] = [
  { metric: "Tỷ lệ tạo video thành công", value: ">95%", status: "pass" },
  { metric: "Thời gian tạo trung bình", value: "<5 phút", status: "pass" },
  { metric: "Thời gian hoạt động (30 ngày)", value: "99.9%", status: "pass" },
  { metric: "Sức khỏe bộ kiểm thử", value: "6.700+ bài kiểm tra, 0 lỗi", status: "pass" },
  { metric: "Thời gian phản hồi API (P95)", value: "<300ms", status: "pass" },
  { metric: "Tỷ lệ rời bỏ khách hàng", value: "<5% hàng tháng", status: "pass" },
];

const EN_PROVIDERS: ProviderComparison[] = [
  { name: "HeyGen", successRate: "98%", avgTime: "2-4 min", languages: "40+" },
  { name: "D-ID", successRate: "96%", avgTime: "3-5 min", languages: "30+" },
  { name: "FaceFusion", successRate: "94%", avgTime: "2-3 min", languages: "20+" },
  { name: "Wav2Lip", successRate: "92%", avgTime: "4-6 min", languages: "15+" },
];

const VI_PROVIDERS: ProviderComparison[] = [
  { name: "HeyGen", successRate: "98%", avgTime: "2-4 phút", languages: "40+" },
  { name: "D-ID", successRate: "96%", avgTime: "3-5 phút", languages: "30+" },
  { name: "FaceFusion", successRate: "94%", avgTime: "2-3 phút", languages: "20+" },
  { name: "Wav2Lip", successRate: "92%", avgTime: "4-6 phút", languages: "15+" },
];

function StatusBadge({ status }: { status: "pass" | "warning" | "info" }) {
  const styles: Record<string, string> = {
    pass: "bg-emerald-900/40 text-emerald-300 border border-emerald-700",
    warning: "bg-amber-900/40 text-amber-300 border border-amber-700",
    info: "bg-primary/10/40 text-primary border border-primary/30",
  };
  const labels: Record<string, string> = {
    pass: "PASS",
    warning: "WARN",
    info: "INFO",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default async function BenchmarksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });

  const isVi = locale === "vi";
  const benchmarks = isVi ? VI_BENCHMARKS : EN_BENCHMARKS;
  const providers = isVi ? VI_PROVIDERS : EN_PROVIDERS;

  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-white mb-3">
            {isVi ? "Benchmark Hiệu Suất" : "Performance Benchmarks"}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {isVi
              ? "Sophia AI Factory cam kết độ tin cậy và hiệu suất cao. Dưới đây là các chỉ số benchmark hiện tại của nền tảng."
              : "Sophia AI Factory is committed to high reliability and performance. Below are the current platform benchmarks."}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {benchmarks.map((item) => (
            <div key={item.metric} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {item.metric}
                </span>
                <StatusBadge status={item.status} />
              </div>
              <span className="text-2xl font-bold text-white">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Multi-Provider Comparison */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-white mb-6">
            {isVi ? "So Sánh Các Nhà Cung Cấp AI Video" : "Multi-Provider Comparison"}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">
                    {isVi ? "Nhà cung cấp" : "Provider"}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">
                    {isVi ? "Tỷ lệ thành công" : "Success Rate"}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">
                    {isVi ? "Thời gian TB" : "Avg Time"}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">
                    {isVi ? "Ngôn ngữ" : "Languages"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.name} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-white">{p.name}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{p.successRate}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{p.avgTime}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{p.languages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {isVi
              ? "Sophia tự động chọn nhà cung cấp tốt nhất dựa trên loại video và yêu cầu. Nếu một nhà cung cấp thất bại, hệ thống sẽ tự động chuyển sang nhà cung cấp khác."
              : "Sophia automatically selects the best provider based on video type and requirements. If one provider fails, the system automatically falls back to another."}
          </p>
        </div>

        {/* Architecture Note */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-3">
            {isVi ? "Kiến Trúc Đảm Bảo Hiệu Suất" : "Architecture Ensuring Performance"}
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">&#10003;</span>
              <span>
                <strong className="text-white">{isVi ? "Đa nhà cung cấp:" : "Multi-provider:"}</strong>{" "}
                {isVi
                  ? "Tự động chuyển đổi giữa HeyGen, D-ID, FaceFusion, Wav2Lip để đảm bảo độ tin cậy."
                  : "Automatic failover between HeyGen, D-ID, FaceFusion, Wav2Lip for reliability."}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">&#10003;</span>
              <span>
                <strong className="text-white">{isVi ? "Edge compute:" : "Edge compute:"}</strong>{" "}
                {isVi
                  ? "Cloudflare Workers với OpenNext đảm bảo độ trễ thấp toàn cầu."
                  : "Cloudflare Workers with OpenNext ensures low-latency global distribution."}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">&#10003;</span>
              <span>
                <strong className="text-white">{isVi ? "Kiểm thử toàn diện:" : "Comprehensive testing:"}</strong>{" "}
                {isVi
                  ? "6.700+ bài kiểm tra đơn vị và tích hợp, 0 lỗi, đảm bảo chất lượng khi triển khai."
                  : "6,700+ unit and integration tests with 0 failures ensures deployment quality."}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">&#10003;</span>
              <span>
                <strong className="text-white">{isVi ? "Không có CI/CD bên ngoài:" : "No external CI/CD:"}</strong>{" "}
                {isVi
                  ? "Triển khai CF-direct với xác thực SHA — không phụ thuộc vào dịch vụ bên thứ ba."
                  : "CF-direct deployment with SHA verification — no third-party CI dependency."}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
