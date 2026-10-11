/**
 * Bilingual Markdown Legal Terms Renderer
 *
 * Renders legally binding bilingual (VI/EN) markdown contract terms.
 *
 * Layer: tree (Pure domain logic — zero I/O)
 *
 * @module tree/contracts/generator/markdown-renderer
 */

import type { EnterpriseContract } from '@/seed/types/enterprise-contracts';
import { PERMITTED_MONTHLY_DOWNTIME_FORMATTED } from './types';
import { formatUsd } from './clause-builder';

/**
 * Generate full bilingual (VI/EN) markdown contract terms document.
 */
export function generateContractLegalTerms(
  contract: EnterpriseContract,
  locale: 'vi' | 'en' = 'vi',
): string {
  const isVi = locale === 'vi';
  const monthlyUsd = formatUsd(contract.monthlyCommitmentCents);
  const annualUsd = formatUsd(contract.annualCommitmentCents);
  const unitPriceUsd = `$${(contract.unitPricePerMcuCents / 100).toFixed(4)}`;
  const discountDisplay = `${(contract.volumeDiscountPercent * 100).toFixed(0)}%`;

  if (isVi) {
    return `# HỢP ĐỒNG DỊCH VỤ ĐIỆN TOÁN DOANH NGHIỆP & CAM KẾT CHẤT LƯỢNG DỊCH VỤ (SLA)
**Mã số hợp đồng:** ${contract.contractNumber}
**Phiên bản điều khoản:** ${contract.termsVersion}
**Mã băm toàn vẹn SHA-256:** \`${contract.contractSha256}\`
**Ngày hiệu lực:** ${contract.effectiveDate} | **Ngày kết thúc:** ${contract.expirationDate}

---

### ĐIỀU 1: CÁC BÊN THAM GIA
1. **Bên Cung Cấp Dịch Vụ:** CÔNG TY CỔ PHẦN CÔNG NGHỆ SOPHIA AI FACTORY
   - Nền tảng: Hệ thống Nhà máy Sản xuất Video AI & Lưới Điện toán Đám mây Cạnh Toàn cầu (Cloudflare Edge).
2. **Bên Sử Dụng Dịch Vụ (Khách Hàng Doanh Nghiệp):** Tổ chức ID: \`${contract.orgId}\`
   ${contract.customerSignerName ? `- Đại diện ký kết: **${contract.customerSignerName}** (${contract.customerSignerTitle || 'Đại diện được ủy quyền'})` : ''}
   ${contract.customerSignerEmail ? `- Email liên hệ: ${contract.customerSignerEmail}` : ''}

---

### ĐIỀU 2: PHẠM VI DỊCH VỤ & DUNG LƯỢNG ĐIỆN TOÁN CAM KẾT (MCU)
1. **Hạn mức dung lượng hàng tháng:** **${contract.mcuCapacityMonthly.toLocaleString('vi-VN')} MCU** (Model Compute Units)/tháng.
2. **Đơn giá ưu đãi theo khối lượng:** **${unitPriceUsd}/MCU** (Đã áp dụng chiết khấu khối lượng **${discountDisplay}** so với đơn giá tiêu chuẩn $0.050/MCU).
3. **Chu kỳ thanh toán:** **${contract.billingCycle === 'annual' ? 'Hàng năm (Tiết kiệm 17%)' : 'Hàng tháng'}**
4. **Cam kết phí định kỳ:**
   - Giá trị thanh toán hàng tháng: **${monthlyUsd}**
   - Giá trị cam kết cả năm: **${annualUsd}**
5. **Cơ chế điện toán vượt định mức (Burst Overage):** Mọi dung lượng tính toán phát sinh ngoài hạn mức cam kết trong chu kỳ sẽ được áp dụng trực tiếp đơn giá ưu đãi hợp đồng (**${unitPriceUsd}/MCU**), bảo vệ doanh nghiệp khỏi đơn giá công khai $0.10/MCU.

---

### ĐIỀU 3: CAM KẾT CHẤT LƯỢNG DỊCH VỤ (SLA 99.9% UPTIME)
1. **Cam kết mức độ sẵn sàng:** Sophia AI Factory cam kết hệ thống Cổng API và Cụm Xử lý Video duy trì mức độ sẵn sàng tối thiểu **${contract.slaUptimePercent}%** trong mỗi chu kỳ lịch 30 ngày.
2. **Thời gian gián đoạn tối đa cho phép:** Không vượt quá **${PERMITTED_MONTHLY_DOWNTIME_FORMATTED}** mỗi tháng đối với các sự cố ngoài kế hoạch bảo trì.
3. **Biểu khấu trừ và hoàn tiền dịch vụ (Service Credit Remedy Schedule):**
   - Khả dụng $\\ge 99.90\\%$: Hoạt động chuẩn SLA — Không áp dụng tín dụng bồi thường.
   - Khả dụng $99.00\\% - 99.89\\%$: Tín dụng hoàn lại **10%** giá trị chu kỳ thanh toán.
   - Khả dụng $95.00\\% - 98.99\\%$: Tín dụng hoàn lại **25%** giá trị chu kỳ thanh toán.
   - Khả dụng $< 95.00\\%$: Tín dụng hoàn lại **50%** giá trị chu kỳ thanh toán.
4. **Cơ chế giải ngân tín dụng SLA:** Tín dụng dịch vụ được tự động áp dụng để trừ vào kỳ thanh toán tiếp theo hoặc hoàn trả vào hạn mức MCU tương đương theo yêu cầu của Khách Hàng.

---

### ĐIỀU 4: TOÀN VẸN MẬT MÃ & CHỮ KÝ ĐIỆN TỬ
1. Hợp đồng này được mã hóa toàn vẹn bằng thuật toán SHA-256 chuẩn RFC-8785 JSON Canonicalization.
2. Bất kỳ thay đổi nào đối với các điều khoản, giá trị cam kết hoặc dung lượng sẽ làm sai lệch mã băm \`${contract.contractSha256}\` và tự động làm vô hiệu hóa hợp đồng.
3. **Chữ ký Khách Hàng:** ${contract.customerSignatureHash ? `\`${contract.customerSignatureHash}\` (Đã ký lúc ${contract.customerSignedAt ? new Date(contract.customerSignedAt * 1000).toISOString() : 'N/A'})` : 'Chờ ký điện tử'}
4. **Chữ ký Đối tác Nền tảng:** ${contract.platformSignatureHash ? `\`${contract.platformSignatureHash}\` (Đã ký lúc ${contract.platformSignedAt ? new Date(contract.platformSignedAt * 1000).toISOString() : 'N/A'})` : 'Chờ đối soát hệ thống'}

---
*Văn bản này có giá trị pháp lý ràng buộc điện tử giữa các bên theo Luật Giao dịch Điện tử.*`;
  }

  // English version
  return `# ENTERPRISE COMPUTE SERVICE AGREEMENT & SERVICE LEVEL COMMITMENT (SLA)
**Contract Number:** ${contract.contractNumber}
**Terms Version:** ${contract.termsVersion}
**Cryptographic SHA-256 Digest:** \`${contract.contractSha256}\`
**Effective Date:** ${contract.effectiveDate} | **Expiration Date:** ${contract.expirationDate}

---

### SECTION 1: PARTIES
1. **Service Provider:** SOPHIA AI FACTORY TECHNOLOGY JOINT STOCK COMPANY
   - Platform: Autonomous AI Video Factory & Global Edge CDN Compute Mesh (Cloudflare Edge).
2. **Enterprise Customer:** Organization ID: \`${contract.orgId}\`
   ${contract.customerSignerName ? `- Authorized Signatory: **${contract.customerSignerName}** (${contract.customerSignerTitle || 'Authorized Representative'})` : ''}
   ${contract.customerSignerEmail ? `- Contact Email: ${contract.customerSignerEmail}` : ''}

---

### SECTION 2: COMMITTED COMPUTE CAPACITY & VOLUME PRICING
1. **Committed Monthly Capacity:** **${contract.mcuCapacityMonthly.toLocaleString('en-US')} MCU** (Model Compute Units)/month.
2. **Volume Discounted Unit Rate:** **${unitPriceUsd}/MCU** (Reflects a **${discountDisplay}** volume discount against baseline $0.050/MCU rate).
3. **Billing Cycle:** **${contract.billingCycle === 'annual' ? 'Annual (17% Prepayment Savings Applied)' : 'Monthly'}**
4. **Recurring Commitment Totals:**
   - Monthly Commitment Value: **${monthlyUsd}**
   - Annualized Commitment Value: **${annualUsd}**
5. **Burst Compute & Overage Protection:** Any compute consumption beyond the committed allocation during a billing period is billed at the contracted effective unit rate (**${unitPriceUsd}/MCU**), protecting the enterprise from the default on-demand rate ($0.10/MCU).

---

### SECTION 3: 99.9% UPTIME SERVICE LEVEL COMMITMENT (SLA)
1. **Availability Guarantee:** Sophia AI Factory warrants that the edge API gateways and video rendering queue workers will achieve at least **${contract.slaUptimePercent}%** monthly availability during each calendar month.
2. **Maximum Permitted Monthly Downtime:** Unscheduled downtime shall not exceed **${PERMITTED_MONTHLY_DOWNTIME_FORMATTED}** per 30-day billing period.
3. **Financial Service Credit Remedy Schedule:**
   - Availability $\\ge 99.90\\%$: Normal operating SLA target — No service credit applicable.
   - Availability $99.00\\% - 99.89\\%$: **10%** billing cycle service credit.
   - Availability $95.00\\% - 98.99\\%$: **25%** billing cycle service credit.
   - Availability $< 95.00\\%$: **50%** billing cycle service credit.
4. **Remedy Disbursement:** Service credits are automatically applied against subsequent billing invoice cycles or credited as equivalent compute units upon customer election.

---

### SECTION 4: CRYPTOGRAPHIC SIGNATURE & AUDIT TRAIL
1. This agreement is cryptographically anchored via SHA-256 RFC-8785 JSON Canonicalization.
2. Any tampering or alteration of terms, capacity numbers, or price parameters invalidates the canonical digest \`${contract.contractSha256}\`.
3. **Customer Signature:** ${contract.customerSignatureHash ? `\`${contract.customerSignatureHash}\` (Executed on ${contract.customerSignedAt ? new Date(contract.customerSignedAt * 1000).toISOString() : 'N/A'})` : 'Pending digital execution'}
4. **Platform Counter-Signature:** ${contract.platformSignatureHash ? `\`${contract.platformSignatureHash}\` (Executed on ${contract.platformSignedAt ? new Date(contract.platformSignedAt * 1000).toISOString() : 'N/A'})` : 'Pending platform verification'}

---
*This digital instrument represents a legally binding agreement under applicable electronic transactions law.*`;
}
