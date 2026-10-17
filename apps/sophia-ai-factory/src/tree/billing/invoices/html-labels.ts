/**
 * Bilingual Invoice Labels & Tax Notes
 *
 * @module tree/billing/invoices/html-labels
 */

import type { EInvoice } from '@/seed/types/enterprise-billing';

export function resolveTaxFormNote(taxFormType: EInvoice['taxFormType'], isVi: boolean): string {
  if (taxFormType === 'W8_BEN') {
    return 'Entity certified as non-US resident person/entity under Form W-8BEN treaty exemption.';
  }
  if (taxFormType === 'W9') {
    return 'Entity certified with US Taxpayer Identification Number under Form W-9.';
  }
  return isVi
    ? 'Hóa đơn điện tử khởi tạo từ hệ thống Sophia AI Factory tuân thủ quy định thuế số và thương mại điện tử Việt Nam.'
    : 'Electronic VAT invoice issued by Sophia AI Factory under enterprise SaaS software license.';
}

export const VI_LABELS = {
  docTitle: 'Hóa đơn Điện tử', printBtn: 'In hóa đơn / Lưu PDF', invoiceHeading: 'HÓA ĐƠN ĐIỆN TỬ',
  sellerHeading: 'Đơn vị phát hành (Seller)', sellerTaxIdLabel: 'Mã số thuế (MST)',
  customerHeading: 'Đơn vị mua hàng (Customer)', customerTaxIdLabel: 'Mã số thuế / MST',
  naText: 'Không áp dụng', taxFormLabel: 'Mẫu chứng từ thuế', subaccountLabel: 'Tài khoản phụ',
  issueDateLabel: 'Ngày phát hành', billingCycleLabel: 'Chu kỳ thanh toán',
  paymentDateLabel: 'Ngày thanh toán', unpaidText: 'Chưa thanh toán',
  descCol: 'Mô tả dịch vụ', qtyCol: 'Số lượng', unitPriceCol: 'Đơn giá', totalCol: 'Thành tiền',
  lineItemDesc: 'Quyền truy cập toàn diện tính năng cấp doanh nghiệp & hạn ngạch kết xuất video',
  subtotalLabel: 'Cộng tiền hàng', grandTotalLabel: 'Tổng tiền thanh toán',
  legalNoteHeading: 'Lưu ý pháp lý & Thuế', verificationRefLabel: 'Mã chứng từ đối soát',
  status: { draft: 'Bản nháp', issued: 'Đã phát hành', paid: 'Đã thanh toán', void: 'Đã hủy' },
} as const;

export const EN_LABELS = {
  docTitle: 'Electronic Invoice', printBtn: 'Print Invoice / Save PDF', invoiceHeading: 'TAX INVOICE',
  sellerHeading: 'Seller', sellerTaxIdLabel: 'Tax ID',
  customerHeading: 'Customer', customerTaxIdLabel: 'Tax ID',
  naText: 'N/A', taxFormLabel: 'Tax Form', subaccountLabel: 'Subaccount',
  issueDateLabel: 'Issue Date', billingCycleLabel: 'Billing Cycle',
  paymentDateLabel: 'Payment Date', unpaidText: 'Unpaid',
  descCol: 'Description', qtyCol: 'Qty', unitPriceCol: 'Unit Price', totalCol: 'Total',
  lineItemDesc: 'Enterprise subscription license & compute allocation',
  subtotalLabel: 'Subtotal', grandTotalLabel: 'Total',
  legalNoteHeading: 'Legal & Tax Notes', verificationRefLabel: 'Verification Ref',
  status: { draft: 'Draft', issued: 'Issued', paid: 'Paid', void: 'Void' },
} as const;
