/**
 * /benchmarks — Public benchmarks page.
 *
 * Server Component: displays Sophia AI Factory performance benchmarks.
 * Bilingual (vi + en) with ISR at 3600s.
 *
 * @module app/benchmarks/page
 */

import React from "react";
import { Metadata } from "next";
import {
  EN_BENCHMARKS,
  VI_BENCHMARKS,
  EN_PROVIDERS,
  VI_PROVIDERS,
} from "./components/benchmark-data";
import { StatusBadge } from "./components/status-badge";
import { ProviderComparisonTable } from "./components/provider-comparison-table";
import { ArchitectureNotes } from "./components/architecture-notes";

export const revalidate = 3600;
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Performance Benchmarks | Sophia AI Factory",
  description:
    "Platform performance benchmarks including video generation success rate, uptime, test suite health, and multi-provider comparison.",
};

export default async function BenchmarksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isVi = locale === "vi";
  const benchmarks = isVi ? VI_BENCHMARKS : EN_BENCHMARKS;
  const providers = isVi ? VI_PROVIDERS : EN_PROVIDERS;

  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4">
      <div className="max-w-4xl mx-auto">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {benchmarks.map((item) => (
            <div
              key={item.metric}
              className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2"
            >
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

        <ProviderComparisonTable providers={providers} isVi={isVi} />
        <ArchitectureNotes isVi={isVi} />
      </div>
    </main>
  );
}
