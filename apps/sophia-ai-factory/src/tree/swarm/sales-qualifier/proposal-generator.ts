import type { InboundLeadPayload } from '@/seed/types/autonomous-swarm';

/**
 * Generates an executive bilingual proposal (EN + VI) for qualified leads.
 */
export function generateBilingualProposal(
  lead: InboundLeadPayload,
  bantScore: number,
  recommendedTier: string
): string {
  const mcuFormatted = (lead.requestedMcuMonthly ?? 50_000).toLocaleString('en-US');
  const arrUsd = lead.dealValueEstimateCents
    ? `$${(lead.dealValueEstimateCents / 100).toLocaleString('en-US')}`
    : '$24,000 - $60,000';

  return `
================================================================================
SOPHIA AI FACTORY — ENTERPRISE SOLUTION PROPOSAL
BẢN ĐỀ XUẤT GIẢI PHÁP DOANH NGHIỆP TỰ TRỊ
================================================================================

Target Client / Khách hàng: ${lead.companyName} (${lead.companyDomain})
Primary Contact / Đại diện: ${lead.leadName} (${lead.leadTitle ?? 'Decision Maker'})
Qualification Score / Điểm BANT: ${bantScore}/100 [AUTO-QUALIFIED]
Recommended Plan / Gói khuyến nghị: ${recommendedTier}

--------------------------------------------------------------------------------
1. EXECUTIVE SUMMARY / TỔNG QUAN GIẢI PHÁP
--------------------------------------------------------------------------------
EN:
Sophia AI Factory offers an autonomous multi-modal AI video engine designed to
scale ${lead.companyName}'s global distribution. With our Dedicated Edge GPU Lane,
autonomous APAC dubbing in 5 languages (VI, EN, JA, KO, TH), and multi-platform
syndication, your marketing and growth operations achieve 10x velocity.

VI:
Sophia AI Factory cung cấp cỗ máy sản xuất video AI tự trị đa phương thức được
thiết kế tối ưu cho quy mô tiếp thị toàn cầu của ${lead.companyName}. Với làn GPU
chuyên dụng trên Edge, lồng tiếng APAC 5 ngôn ngữ bản xứ và tự động phát hành
đa kênh, doanh nghiệp đạt bước nhảy vọt gấp 10 lần hiệu suất tăng trưởng.

--------------------------------------------------------------------------------
2. COMMERCIAL COMMITMENTS / CAM KẾT THƯƠNG MẠI
--------------------------------------------------------------------------------
- Monthly Quota / Hạn ngạch hàng tháng: ${mcuFormatted} MCU
- Estimated Annual Value / Giá trị hợp đồng: ${arrUsd}/year
- Uptime SLA / Cam kết độ khả dụng: 99.999% Five-Nines Edge SLA
- Data Residency / Quyền riêng tư dữ liệu: Sovereign In-Region Data Processing

--------------------------------------------------------------------------------
3. NEXT STEPS / BƯỚC TRIỂN KHAI TIẾP THEO
--------------------------------------------------------------------------------
1. 1-Click Sandbox Demo Workspace Activation.
2. Technical Architecture & Dedicated GPU Lane Allocation Review.
3. SLA & Volume Contract Execution via Cryptographic Signature.
`.trim();
}
