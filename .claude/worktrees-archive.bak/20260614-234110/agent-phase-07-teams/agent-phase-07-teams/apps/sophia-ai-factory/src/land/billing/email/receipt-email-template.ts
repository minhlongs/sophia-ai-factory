/**
 * Receipt email template — renders bilingual HTML + plain text.
 * Vietnamese law requires VAT 10% notice on digital services.
 * @module billing/email/receipt-email-template
 */

export interface ReceiptInput {
  email: string
  userName?: string
  tier: string
  period: 'monthly' | 'yearly' | 'lifetime'
  amountUsd: number
  paymentId: string
  paymentMethod: 'nowpayments' | 'payos'
  orderId: string
  locale?: string
}

const TIER_NAMES: Record<string, { en: string; vi: string }> = {
  BASIC: { en: 'Starter', vi: 'Starter' },
  PREMIUM: { en: 'Growth', vi: 'Growth' },
  ENTERPRISE: { en: 'Premium', vi: 'Premium' },
  MASTER: { en: 'Master', vi: 'Master' },
}

const PERIOD_LABELS: Record<string, { en: string; vi: string }> = {
  monthly: { en: 'Monthly', vi: 'Hàng tháng' },
  yearly: { en: 'Yearly', vi: 'Hàng năm' },
  lifetime: { en: 'Lifetime', vi: 'Trọn đời' },
}

export interface ReceiptOutput {
  subject: string
  html: string
  text: string
}

export function renderReceipt(input: ReceiptInput): ReceiptOutput {
  const isVi = input.locale === 'vi'
  const tierName = TIER_NAMES[input.tier]?.[isVi ? 'vi' : 'en'] ?? input.tier
  const periodLabel = PERIOD_LABELS[input.period]?.[isVi ? 'vi' : 'en'] ?? input.period
  const paymentIdShort = input.paymentId.slice(0, 8)
  const amountFormatted = `$${input.amountUsd.toFixed(2)} USD`
  const date = new Date().toLocaleDateString(isVi ? 'vi-VN' : 'en-US', { dateStyle: 'long' })
  const payMethodLabel = input.paymentMethod === 'payos' ? 'PayOS VND' : 'NOWPayments (USDT/Crypto)'

  const subject = isVi
    ? `Hóa đơn — Sophia AI Factory — Gói ${tierName}`
    : `Receipt — Sophia AI Factory — ${tierName} Plan`

  // VAT notice: Vietnamese digital services (dịch vụ số) 10% VAT
  const vatNotice = isVi
    ? `<p style="font-size:12px;color:#888;">Lưu ý: Dịch vụ số tại Việt Nam chịu thuế VAT 10% theo quy định pháp luật. Giá trên đã bao gồm VAT. Hóa đơn này là xác nhận thanh toán, không phải hóa đơn VAT chính thức.</p>`
    : `<p style="font-size:12px;color:#888;">VAT Notice: Digital services in Vietnam are subject to 10% VAT per Vietnamese law. The amount above is inclusive of VAT. This receipt is a payment confirmation, not an official VAT invoice.</p>`

  const vatTextNotice = isVi
    ? 'Lưu ý thuế VAT: Dịch vụ số 10% VAT (đã bao gồm trong giá). Không phải hóa đơn VAT chính thức.'
    : 'VAT Notice: Digital services 10% VAT included. This is not an official VAT invoice.'

  const html = `<!DOCTYPE html>
<html lang="${isVi ? 'vi' : 'en'}">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#e0e0e0;padding:40px 20px;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#111;border:1px solid #333;border-radius:12px;padding:32px;">
    <h1 style="color:#7c3aed;margin-top:0;">${isVi ? 'Hóa đơn thanh toán' : 'Payment Receipt'}</h1>
    <p style="color:#aaa;">${isVi ? 'Cảm ơn bạn đã sử dụng Sophia AI Factory!' : 'Thank you for choosing Sophia AI Factory!'}</p>

    <table style="width:100%;border-collapse:collapse;margin:24px 0;">
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:10px 0;color:#888;">${isVi ? 'Mã đơn hàng' : 'Order ID'}</td>
        <td style="padding:10px 0;text-align:right;font-family:monospace;">${input.orderId.slice(-16)}</td>
      </tr>
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:10px 0;color:#888;">${isVi ? 'Mã thanh toán' : 'Payment ID'}</td>
        <td style="padding:10px 0;text-align:right;font-family:monospace;">${paymentIdShort}***</td>
      </tr>
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:10px 0;color:#888;">${isVi ? 'Gói dịch vụ' : 'Plan'}</td>
        <td style="padding:10px 0;text-align:right;font-weight:bold;color:#7c3aed;">${tierName}</td>
      </tr>
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:10px 0;color:#888;">${isVi ? 'Chu kỳ' : 'Billing period'}</td>
        <td style="padding:10px 0;text-align:right;">${periodLabel}</td>
      </tr>
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:10px 0;color:#888;">${isVi ? 'Phương thức' : 'Payment method'}</td>
        <td style="padding:10px 0;text-align:right;">${payMethodLabel}</td>
      </tr>
      <tr style="border-bottom:1px solid #333;">
        <td style="padding:10px 0;color:#888;">${isVi ? 'Ngày' : 'Date'}</td>
        <td style="padding:10px 0;text-align:right;">${date}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;font-weight:bold;">${isVi ? 'Tổng cộng' : 'Total'}</td>
        <td style="padding:10px 0;text-align:right;font-weight:bold;color:#10b981;">${amountFormatted}</td>
      </tr>
    </table>

    ${vatNotice}

    <hr style="border:none;border-top:1px solid #333;margin:24px 0;">
    <p style="font-size:13px;color:#666;">
      ${isVi ? 'Cần hỗ trợ?' : 'Need help?'}
      <a href="mailto:support@mekongmind.com" style="color:#7c3aed;">support@mekongmind.com</a>
    </p>
    <p style="font-size:12px;color:#444;">Sophia AI Factory — AgencyOS</p>
  </div>
</body>
</html>`

  const text = [
    subject,
    '',
    isVi ? 'Cảm ơn bạn đã sử dụng Sophia AI Factory!' : 'Thank you for choosing Sophia AI Factory!',
    '',
    `${isVi ? 'Mã đơn hàng' : 'Order ID'}: ${input.orderId.slice(-16)}`,
    `${isVi ? 'Mã thanh toán' : 'Payment ID'}: ${paymentIdShort}***`,
    `${isVi ? 'Gói dịch vụ' : 'Plan'}: ${tierName}`,
    `${isVi ? 'Chu kỳ' : 'Billing period'}: ${periodLabel}`,
    `${isVi ? 'Phương thức' : 'Payment method'}: ${payMethodLabel}`,
    `${isVi ? 'Ngày' : 'Date'}: ${date}`,
    `${isVi ? 'Tổng cộng' : 'Total'}: ${amountFormatted}`,
    '',
    vatTextNotice,
    '',
    `${isVi ? 'Hỗ trợ' : 'Support'}: support@mekongmind.com`,
    'Sophia AI Factory — AgencyOS',
  ].join('\n')

  return { subject, html, text }
}
