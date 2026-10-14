/**
 * Benchmark metrics and provider comparison datasets (bilingual en/vi).
 */

import type { BenchmarkItem, ProviderComparison } from './types';

export const EN_BENCHMARKS: BenchmarkItem[] = [
  { metric: "Video Generation Success Rate", value: ">95%", status: "pass" },
  { metric: "Average Generation Time", value: "<5 min", status: "pass" },
  { metric: "Platform Uptime (30-day rolling)", value: "99.9%", status: "pass" },
  { metric: "Test Suite Health", value: "6,700+ tests, 0 failures", status: "pass" },
  { metric: "API Response Time (P95)", value: "<300ms", status: "pass" },
  { metric: "Customer Churn Rate", value: "<5% monthly", status: "pass" },
];

export const VI_BENCHMARKS: BenchmarkItem[] = [
  { metric: "Tỷ lệ tạo video thành công", value: ">95%", status: "pass" },
  { metric: "Thời gian tạo trung bình", value: "<5 phút", status: "pass" },
  { metric: "Thời gian hoạt động (30 ngày)", value: "99.9%", status: "pass" },
  { metric: "Sức khỏe bộ kiểm thử", value: "6.700+ bài kiểm tra, 0 lỗi", status: "pass" },
  { metric: "Thời gian phản hồi API (P95)", value: "<300ms", status: "pass" },
  { metric: "Tỷ lệ rời bỏ khách hàng", value: "<5% hàng tháng", status: "pass" },
];

export const EN_PROVIDERS: ProviderComparison[] = [
  { name: "HeyGen", successRate: "98%", avgTime: "2-4 min", languages: "40+" },
  { name: "D-ID", successRate: "96%", avgTime: "3-5 min", languages: "30+" },
  { name: "FaceFusion", successRate: "94%", avgTime: "2-3 min", languages: "20+" },
  { name: "Wav2Lip", successRate: "92%", avgTime: "4-6 min", languages: "15+" },
];

export const VI_PROVIDERS: ProviderComparison[] = [
  { name: "HeyGen", successRate: "98%", avgTime: "2-4 phút", languages: "40+" },
  { name: "D-ID", successRate: "96%", avgTime: "3-5 phút", languages: "30+" },
  { name: "FaceFusion", successRate: "94%", avgTime: "2-3 phút", languages: "20+" },
  { name: "Wav2Lip", successRate: "92%", avgTime: "4-6 phút", languages: "15+" },
];
