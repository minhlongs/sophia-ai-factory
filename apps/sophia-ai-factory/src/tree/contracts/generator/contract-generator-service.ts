/**
 * Enterprise SLA HTML Document Renderer
 *
 * Generates clean, responsive, print-ready HTML documents for enterprise SLA contracts.
 *
 * Layer: tree (Pure domain logic — zero I/O)
 *
 * @module tree/contracts/generator/contract-generator-service
 */

import type { EnterpriseContract } from '@/seed/types/enterprise-contracts';
import { PERMITTED_MONTHLY_DOWNTIME_FORMATTED } from './types';
import { formatUsd } from './clause-builder';

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
