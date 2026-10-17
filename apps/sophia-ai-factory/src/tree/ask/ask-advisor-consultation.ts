/**
 * Bilingual Natural Language Ask Router — 4-Advisor Architecture Consultation
 *
 * Layer: tree/ask
 * @module tree/ask/ask-advisor-consultation
 */

import type { FourAdvisorConsultation } from './ask-types';

/**
 * Synthesizes a structured 4-Advisor architectural consultation report.
 */
export function generateArchitecturalConsultation(query: string): FourAdvisorConsultation {
  return {
    systemsDesigner: {
      vi: `[Hệ thống & Phân tầng] Yêu cầu "${query}" được thẩm định qua ranh giới 4 tầng Mekong: seed (cốt lõi, types, D1/R2 abstractions), tree (nghiệp vụ thuần túy, services, IoC), forest (state, server actions, inngest pipelines), và land (webhooks, edge API routes, UI). Giữ vững nguyên tắc phụ thuộc một chiều, tuyệt đối không cho phép circular dependency hoặc upward imports.`,
      en: `[Systems Architecture & Boundaries] The request "${query}" is scoped across Mekong 4-Layer boundaries: seed (domain core, D1/R2 abstractions), tree (pure domain logic, services, IoC), forest (state, server actions, inngest orchestration), and land (webhooks, edge API routes, and presentation). Strict one-way dependency rules apply with zero upward or circular imports.`,
    },
    technologyStrategist: {
      vi: `[Chiến lược Công nghệ] Đồng vị trí (co-locate) giữa Next.js 16 trên Cloudflare Workers Edge với Cloudflare D1 (SQLite) và R2 storage nhằm đảm bảo zero-cold start (<15ms). Áp dụng Queue-First pattern cho các tác vụ tính toán nặng và IoC adapter cho dịch vụ bên thứ ba (NOWPayments, PayOS, Resend).`,
      en: `[Technology Strategy] Co-locate Next.js 16 on Cloudflare Workers edge runtime with Cloudflare D1 (SQLite) and R2 storage for near-zero cold starts (<15ms). Enforce queue-first patterns for asynchronous AI pipelines and canonical IoC adapters for third-party providers (NOWPayments, PayOS, Resend).`,
    },
    scalabilityConsultant: {
      vi: `[Hiệu năng & Khả năng Mở rộng] Để xử lý tải đồng thời cao, thực thi thao tác cập nhật quota nguyên tử (Atomic Quota CAS) trực tiếp trên D1. Sử dụng Optimistic Concurrency Control (OCC) với version locking cho sổ cái thanh toán và đặt Cloudflare KV làm tầng đệm đọc (60s TTL) để triệt tiêu hiện tượng write lock contention trên SQLite.`,
      en: `[Scalability & Throughput] Under high concurrent load, enforce atomic quota counter CAS directly in D1. Employ Optimistic Concurrency Control (OCC) with version locking on financial transaction ledgers, backed by Cloudflare KV read-path caching (60s TTL) to prevent SQLite write lock contention.`,
    },
    riskAnalyst: {
      vi: `[An toàn Thông tin & Giảm thiểu Rủi ro] Bắt buộc kiểm tra chữ ký webhook trong thời gian hằng số (timingSafeEqual) kèm cửa sổ chống phát lại (replay window <= 300s). Khóa BYOK phải được mã hóa phong bì AES-GCM-256 có quản lý phiên bản (active key versioning) cho phép xoay vòng khóa không downtime. Tuân thủ triệt để nguyên lý Fail-Closed.`,
      en: `[Security & Risk Mitigation] Webhook verifications must enforce constant-time signature comparison (timingSafeEqual) and strict timestamp replay protection (window <= 300s). BYOK credentials require versioned AES-GCM-256 envelope encryption supporting zero-downtime key rotation. Always fail-closed on verification boundaries.`,
    },
    synthesis: {
      vi: `[Tổng kết 4 Cố Vấn] Giải pháp tối ưu tuân thủ bộ ba YAGNI, KISS, DRY: Không thêm thành phần phụ thuộc ngoài khi D1/KV đáp ứng được; giữ code cô lập theo 4 tầng; và viết kiểm thử tự động 100% trước khi bàn giao.`,
      en: `[4-Advisor Synthesis] Recommended solution adheres strictly to YAGNI, KISS, and DRY: avoid external dependencies where edge primitives suffice; preserve clean 4-layer isolation; and back all interfaces with comprehensive automated verification suites.`,
    },
  };
}

export function formatConsultationMessages(
  trimmed: string,
  consultation: FourAdvisorConsultation,
): { outputMessageVi: string; outputMessageEn: string } {
  const outputMessageVi = [
    `🏛️ [Hội Đồng 4 Cố Vấn Kiến Trúc — Phân Tích & Tư Vấn Chuyên Sâu]`,
    `Câu hỏi: "${trimmed}"`,
    ``,
    `1. Systems Designer (Thiết kế Hệ thống & Phân tầng):`,
    `   ${consultation.systemsDesigner.vi}`,
    ``,
    `2. Technology Strategist (Chiến lược Công nghệ & Edge Synergy):`,
    `   ${consultation.technologyStrategist.vi}`,
    ``,
    `3. Scalability Consultant (Khả năng Mở rộng & Concurrency):`,
    `   ${consultation.scalabilityConsultant.vi}`,
    ``,
    `4. Risk Analyst (Phân tích Rủi ro & An toàn Thông tin):`,
    `   ${consultation.riskAnalyst.vi}`,
    ``,
    `⭐ Kết luận Tổng hợp:`,
    `   ${consultation.synthesis.vi}`,
  ].join('\n');

  const outputMessageEn = [
    `🏛️ [4-Advisor Architectural Consultation & Strategic Guidance]`,
    `Query: "${trimmed}"`,
    ``,
    `1. Systems Designer (Architecture Boundaries & Layering):`,
    `   ${consultation.systemsDesigner.en}`,
    ``,
    `2. Technology Strategist (Technology Stack & Edge Synergy):`,
    `   ${consultation.technologyStrategist.en}`,
    ``,
    `3. Scalability Consultant (Throughput & Concurrency):`,
    `   ${consultation.scalabilityConsultant.en}`,
    ``,
    `4. Risk Analyst (Security & Risk Mitigation):`,
    `   ${consultation.riskAnalyst.en}`,
    ``,
    `⭐ Strategic Synthesis:`,
    `   ${consultation.synthesis.en}`,
  ].join('\n');

  return { outputMessageVi, outputMessageEn };
}
