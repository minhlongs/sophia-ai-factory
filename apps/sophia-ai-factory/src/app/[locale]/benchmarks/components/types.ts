/**
 * Benchmark page data types.
 */

export interface BenchmarkItem {
  metric: string;
  value: string;
  status: "pass" | "warning" | "info";
}

export interface ProviderComparison {
  name: string;
  successRate: string;
  avgTime: string;
  languages: string;
}
