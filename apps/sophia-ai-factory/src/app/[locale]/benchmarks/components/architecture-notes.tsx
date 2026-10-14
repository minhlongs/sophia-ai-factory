/**
 * Architecture notes panel for benchmarks page.
 */

import React from "react";

export function ArchitectureNotes({ isVi }: { isVi: boolean }) {
  const points = [
    {
      title: isVi ? "Đa nhà cung cấp:" : "Multi-provider:",
      desc: isVi
        ? "Tự động chuyển đổi giữa HeyGen, D-ID, FaceFusion, Wav2Lip để đảm bảo độ tin cậy."
        : "Automatic failover between HeyGen, D-ID, FaceFusion, Wav2Lip for reliability.",
    },
    {
      title: isVi ? "Edge compute:" : "Edge compute:",
      desc: isVi
        ? "Cloudflare Workers với OpenNext đảm bảo độ trễ thấp toàn cầu."
        : "Cloudflare Workers with OpenNext ensures low-latency global distribution.",
    },
    {
      title: isVi ? "Kiểm thử toàn diện:" : "Comprehensive testing:",
      desc: isVi
        ? "6.700+ bài kiểm tra đơn vị và tích hợp, 0 lỗi, đảm bảo chất lượng khi triển khai."
        : "6,700+ unit and integration tests with 0 failures ensures deployment quality.",
    },
    {
      title: isVi ? "Không có CI/CD bên ngoài:" : "No external CI/CD:",
      desc: isVi
        ? "Triển khai CF-direct với xác thực SHA — không phụ thuộc vào dịch vụ bên thứ ba."
        : "CF-direct deployment with SHA verification — no third-party CI dependency.",
    },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-bold text-white mb-3">
        {isVi ? "Kiến Trúc Đảm Bảo Hiệu Suất" : "Architecture Ensuring Performance"}
      </h2>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {points.map((pt) => (
          <li key={pt.title} className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">&#10003;</span>
            <span>
              <strong className="text-white">{pt.title}</strong> {pt.desc}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
