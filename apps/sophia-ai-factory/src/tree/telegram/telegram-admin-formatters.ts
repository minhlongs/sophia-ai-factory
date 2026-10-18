/**
 * Telegram Admin Alert Formatters
 * Layer: tree/telegram
 */

import type { LeadAlertPayload, PaymentAlertPayload } from '@/seed/types/telegram-sales';

function getNicheDisplayName(niche: string): string {
  const map: Record<string, string> = {
    ai_agency: '🤖 AI Agency / Automation',
    ecommerce: '🛒 E-commerce / Dropshipping',
    solopreneur: '💼 Solopreneur / Coaching',
    real_estate: '🏠 Real Estate / BĐS',
    beauty: '💄 Beauty & Fashion',
    other: '🌐 Other / Khác',
  };
  return map[niche] || niche;
}

function getBudgetDisplayName(budget: string): string {
  const map: Record<string, string> = {
    low: '< $500 / tháng (Test)',
    mid: '$500 – $2,000 / tháng (Grow)',
    high: '> $2,000 / tháng (Scale)',
  };
  return map[budget] || budget;
}

export function formatLeadQualifiedAlert(lead: LeadAlertPayload): string {
  const nicheLabel = getNicheDisplayName(lead.niche);
  const budgetLabel = getBudgetDisplayName(String(lead.budgetTier));
  const intentTag = lead.leadScore >= 70 ? '🔥 HIGH INTENT' : '🌱 Qualified';
  const usernameTag = lead.username ? ` (@${lead.username})` : '';

  return (
    `🎯 *[SOPHIA LEAD] Khách hàng tiềm năng mới!* (${intentTag})\n\n` +
    `👤 Người dùng: *${lead.firstName}*${usernameTag}\n` +
    `🆔 Telegram Chat ID: \`${lead.chatId}\`\n` +
    `🏷️ Lĩnh vực: *${nicheLabel}*\n` +
    `💰 Ngân sách: *${budgetLabel}*\n` +
    `📈 Điểm tiềm năng: *${lead.leadScore}/100*\n` +
    `📍 Nguồn: *${lead.sourceUtm || lead.campaignId || 'Direct viral link'}*\n` +
    `⏱️ Thời gian: ${new Date().toISOString()}`
  );
}

export function formatPaymentSuccessAlert(payment: PaymentAlertPayload): string {
  const amountVndStr = payment.amountVnd
    ? ` (+${payment.amountVnd.toLocaleString('vi-VN')} VNĐ)`
    : '';
  const emailStr = payment.email ? ` (${payment.email})` : '';
  const promoStr = payment.promoCode ? payment.promoCode : 'N/A';
  const orderStr = payment.orderId ? `\n🧾 Mã đơn hàng: \`${payment.orderId}\`` : '';

  const targetMrr = 5000;
  const currentMrr = payment.currentMrr ?? payment.amountUsd;
  const percent = Math.min(100, Math.round((currentMrr / targetMrr) * 100));
  const filledBlocks = Math.min(10, Math.floor(percent / 10));
  const emptyBlocks = 10 - filledBlocks;
  const progressBar = '▓'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  return (
    `🎉🎉 *[SOPHIA REVENUE] TING TING! THANH TOÁN THÀNH CÔNG!* 🚀\n\n` +
    `💰 Doanh thu: *+${payment.amountUsd} USD*${amountVndStr}\n` +
    `👤 Khách hàng: *${payment.customerName}*${emailStr}\n` +
    `📦 Gói kích hoạt: *${payment.tier}*\n` +
    `🎟️ Mã ưu đãi: *${promoStr}*\n` +
    `🏦 Cổng thanh toán: *${payment.provider.toUpperCase()}*\n` +
    `🆔 Mã giao dịch: \`${payment.paymentId}\`${orderStr}\n\n` +
    `🏁 *Tiến độ $5,000 MRR Goal:*\n` +
    `[${progressBar}] *$${currentMrr.toLocaleString()} / $5,000* (${percent}%)\n` +
    `Khách hàng trả phí: #${payment.customerIndex ?? 1} / 10 khách đầu tiên!`
  );
}
