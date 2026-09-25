/**
 * Enterprise SLA Contract Generator
 *
 * Generates legally binding, bilingual (VI/EN) Enterprise Service Level Agreements (SLA),
 * incorporating 99.9% uptime commitments, permitted downtime limits (43m 49s/month),
 * tiered financial service credit remedy schedules, and cryptographic SHA-256 integrity terms.
 *
 * Layer: tree (Pure domain logic — zero I/O, deterministic)
 *
 * @module tree/contracts/contract-generator
 */

import {
  type EnterpriseContract,
  type SlaRemedyTier,
  SLA_SERVICE_CREDIT_SCHEDULE,
  DEFAULT_SLA_UPTIME_PERCENT,
} from '@/seed/types/enterprise-contracts';

/** Standard average month in days for SLA calculations (365.25 / 12) */
export const AVERAGE_DAYS_PER_MONTH = 30.4375;
/** Permitted monthly downtime display string matching 99.9% uptime target */
export const PERMITTED_MONTHLY_DOWNTIME_FORMATTED = '43m 49s';

/**
 * Calculate exact permitted downtime for a 99.9% availability commitment.
 */
export function calculateMonthlyPermittedDowntime(): {
  totalMinutes: number;
  permittedDowntimeMinutes: number;
  permittedDowntimeSeconds: number;
  formatted: string;
} {
  const totalMinutes = AVERAGE_DAYS_PER_MONTH * 24 * 60; // 43,830 minutes
  const allowedDowntimeFraction = (100 - DEFAULT_SLA_UPTIME_PERCENT) / 100; // 0.001 (0.1%)
  const totalDowntimeMinutes = totalMinutes * allowedDowntimeFraction; // 43.83 minutes
  const minutes = Math.floor(totalDowntimeMinutes);
  const seconds = Math.floor((totalDowntimeMinutes - minutes) * 60);

  return {
    totalMinutes,
    permittedDowntimeMinutes: totalDowntimeMinutes,
    permittedDowntimeSeconds: Math.floor(totalDowntimeMinutes * 60),
    formatted: `${minutes}m ${seconds}s`,
  };
}

/**
 * Determine applicable SLA service credit percentage based on actual monthly availability.
 */
export function resolveSlaServiceCredit(uptimePercent: number): {
  creditPercent: number;
  remedyTier: SlaRemedyTier;
} {
  const clampedUptime = Math.max(0, Math.min(100, uptimePercent));

  for (const tier of SLA_SERVICE_CREDIT_SCHEDULE) {
    if (clampedUptime >= tier.minAvailabilityPercent && clampedUptime <= tier.maxAvailabilityPercent) {
      return {
        creditPercent: tier.creditPercent,
        remedyTier: tier,
      };
    }
  }

  // Fallback for sub-95% availability
  const fallbackTier = SLA_SERVICE_CREDIT_SCHEDULE[SLA_SERVICE_CREDIT_SCHEDULE.length - 1];
  return {
    creditPercent: fallbackTier.creditPercent,
    remedyTier: fallbackTier,
  };
}

/**
 * Format currency cents to USD formatted string.
 */
function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

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

/**
 * Generate clean, responsive, print-ready HTML document for the enterprise SLA contract.
 */
export function generateContractHtml(
  contract: EnterpriseContract,
  locale: 'vi' | 'en' = 'vi',
): string {
  const isVi = locale === 'vi';
  const monthlyUsd = formatUsd(contract.monthlyCommitmentCents);
  const annualUsd = formatUsd(contract.annualCommitmentCents);
  const unitPriceUsd = `$${(contract.unitPricePerMcuCents / 100).toFixed(4)}`;
  const discountDisplay = `${(contract.volumeDiscountPercent * 100).toFixed(0)}%`;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <title>${contract.contractNumber} - Sophia Enterprise SLA</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111827; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22px; color: #0f172a; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
    h2 { font-size: 16px; color: #1e293b; margin-top: 24px; margin-bottom: 8px; }
    .badge { display: inline-block; padding: 4px 8px; background: #e0e7ff; color: #3730a3; font-weight: 600; border-radius: 4px; font-size: 12px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    .code { font-family: monospace; font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; word-break: break-all; }
    .signature-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin-top: 16px; background: #fafafa; }
  </style>
</head>
<body>
  <h1>${isVi ? 'HỢP ĐỒNG DỊCH VỤ ĐIỆN TOÁN DOANH NGHIỆP & CAM KẾT SLA' : 'ENTERPRISE COMPUTE SERVICE & SLA AGREEMENT'}</h1>
  <div class="meta-box">
    <div class="grid">
      <div><strong>${isVi ? 'Số hợp đồng' : 'Contract #'}:</strong> ${contract.contractNumber}</div>
      <div><strong>${isVi ? 'Trạng thái' : 'Status'}:</strong> <span class="badge">${contract.status.toUpperCase()}</span></div>
      <div><strong>${isVi ? 'Ngày hiệu lực' : 'Effective Date'}:</strong> ${contract.effectiveDate}</div>
      <div><strong>${isVi ? 'Ngày kết thúc' : 'Expiration Date'}:</strong> ${contract.expirationDate}</div>
      <div><strong>${isVi ? 'Phiên bản điều khoản' : 'Terms Version'}:</strong> ${contract.termsVersion}</div>
      <div><strong>${isVi ? 'Tổ chức khách hàng' : 'Organization ID'}:</strong> ${contract.orgId}</div>
    </div>
  </div>

  <h2>${isVi ? '1. Định Mức Dung Lượng & Biểu Phí' : '1. Capacity Commitment & Rates'}</h2>
  <table>
    <tr><th>${isVi ? 'Chỉ tiêu' : 'Metric'}</th><th>${isVi ? 'Giá trị' : 'Value'}</th></tr>
    <tr><td>${isVi ? 'Dung lượng MCU hàng tháng' : 'Monthly MCU Allocation'}</td><td><strong>${contract.mcuCapacityMonthly.toLocaleString()} MCU</strong></td></tr>
    <tr><td>${isVi ? 'Đơn vị tính đơn giá ưu đãi' : 'Contracted Unit Price'}</td><td>${unitPriceUsd} / MCU (${discountDisplay} ${isVi ? 'chiết khấu' : 'discount'})</td></tr>
    <tr><td>${isVi ? 'Chu kỳ thanh toán' : 'Billing Cadence'}</td><td>${contract.billingCycle.toUpperCase()}</td></tr>
    <tr><td>${isVi ? 'Cam kết phí hàng tháng' : 'Monthly Commitment'}</td><td>${monthlyUsd}</td></tr>
    <tr><td>${isVi ? 'Cam kết phí cả năm' : 'Annual Commitment'}</td><td><strong>${annualUsd}</strong></td></tr>
  </table>

  <h2>${isVi ? '2. Cam Kết SLA 99.9% & Biểu Bồi Thường' : '2. 99.9% Uptime SLA & Service Credit Remedies'}</h2>
  <p>${isVi ? `Sophia AI Factory cam kết thời gian hoạt động tối thiểu <strong>${contract.slaUptimePercent}%</strong>. Thời gian gián đoạn tối đa cho phép là <strong>${PERMITTED_MONTHLY_DOWNTIME_FORMATTED}</strong> mỗi tháng.` : `Sophia AI Factory commits to <strong>${contract.slaUptimePercent}%</strong> monthly uptime. Maximum permitted unscheduled downtime is <strong>${PERMITTED_MONTHLY_DOWNTIME_FORMATTED}</strong> per month.`}</p>
  <table>
    <tr><th>${isVi ? 'Mức độ sẵn sàng' : 'Monthly Uptime'}</th><th>${isVi ? 'Tỷ lệ hoàn tiền tín dụng' : 'Service Credit Remedy'}</th></tr>
    <tr><td>&ge; 99.90%</td><td>0% (${isVi ? 'Đạt cam kết SLA' : 'SLA Target Met'})</td></tr>
    <tr><td>99.00% &ndash; 99.89%</td><td><strong>10%</strong> ${isVi ? 'tín dụng chu kỳ' : 'cycle credit'}</td></tr>
    <tr><td>95.00% &ndash; 98.99%</td><td><strong>25%</strong> ${isVi ? 'tín dụng chu kỳ' : 'cycle credit'}</td></tr>
    <tr><td>&lt; 95.00%</td><td><strong>50%</strong> ${isVi ? 'tín dụng chu kỳ' : 'cycle credit'}</td></tr>
  </table>

  <h2>${isVi ? '3. Xác Thực Chữ Ký Điện Tử SHA-256' : '3. Cryptographic Signatures (SHA-256)'}</h2>
  <p><strong>${isVi ? 'Mã băm toàn vẹn' : 'Canonical SHA-256 Digest'}:</strong><br/><span class="code">${contract.contractSha256}</span></p>

  <div class="signature-card">
    <strong>${isVi ? 'Chữ ký Khách Hàng Doanh Nghiệp' : 'Customer Digital Signature'}:</strong><br/>
    ${isVi ? 'Người ký' : 'Signer'}: ${contract.customerSignerName || 'N/A'} (${contract.customerSignerTitle || 'N/A'}) &lt;${contract.customerSignerEmail || 'N/A'}&gt;<br/>
    ${isVi ? 'Mã chữ ký' : 'Signature Hash'}: <span class="code">${contract.customerSignatureHash || 'PENDING'}</span>
  </div>

  <div class="signature-card">
    <strong>${isVi ? 'Chữ ký Nền Tảng Sophia AI Factory' : 'Sophia AI Factory Platform Counter-Signature'}:</strong><br/>
    ${isVi ? 'Mã chữ ký' : 'Counter-Signature Hash'}: <span class="code">${contract.platformSignatureHash || 'PENDING'}</span>
  </div>
</body>
</html>`;
}
