/**
 * Multi-provider benchmark comparison table.
 */

import React from "react";
import type { ProviderComparison } from "./types";

interface ProviderTableProps {
  providers: ProviderComparison[];
  isVi: boolean;
}

export function ProviderComparisonTable({ providers, isVi }: ProviderTableProps) {
  return (
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
  );
}
