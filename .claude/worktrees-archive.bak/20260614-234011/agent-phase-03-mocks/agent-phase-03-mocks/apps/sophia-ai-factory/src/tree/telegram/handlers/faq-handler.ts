/**
 * Auto-FAQ keyword detection for Telegram bot
 * Matches common Vietnamese/English support questions and returns canned responses.
 * Called BEFORE the "unknown command" fallback in the text message handler.
 */

const FAQ_RESPONSES: Record<string, string> = {
  'api key|khoá api|key api': '🔑 Để thiết lập API Keys, vào Dashboard → Cài Đặt → API Keys. Bạn cần 3 keys: OpenRouter, ElevenLabs, D-ID. Hướng dẫn chi tiết: sophia.agencyos.network/vi/guide/integrations',
  'thanh toán|payment|trả phí|nâng cấp|upgrade': '💳 Sophia chấp nhận thanh toán USDT qua NOWPayments. Vào Dashboard → Bảng Giá để chọn gói. Gói Starter từ $199/tháng.',
  'video bị lỗi|video fail|lỗi video|error': '⚠️ Nếu video bị lỗi, thử: 1) Kiểm tra API keys còn hạn 2) Nhấn "Chạy Lại" trên Dashboard 3) Đợi 15 phút rồi thử lại. Vẫn lỗi? Gõ /ticket để gửi yêu cầu hỗ trợ.',
  'kết nối youtube|youtube channel|liên kết youtube': '📺 Vào Dashboard → Cài Đặt → Kết Nối YouTube → Nhấn "Kết Nối". Bạn cần đăng nhập Google và cấp quyền cho Sophia.',
  'mcu|credit|tín dụng': '📊 MCU (Media Credit Unit) là đơn vị tính phí. Kiểm tra số dư MCU trong Dashboard → Tổng Quan. Gói Starter: 1,000 MCU/tháng.',
}

/**
 * Match incoming text against FAQ patterns.
 * Returns canned response string or null if no match.
 */
export function matchFaq(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [pattern, response] of Object.entries(FAQ_RESPONSES)) {
    if (pattern.split('|').some(kw => lower.includes(kw))) {
      return response
    }
  }
  return null
}
