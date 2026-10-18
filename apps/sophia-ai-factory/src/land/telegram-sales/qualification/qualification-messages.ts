/**
 * Telegram Sales Qualification Message Templates
 * Layer: land/telegram-sales/qualification
 */

import type { SampleVideoItem } from '../sample-video-catalog';

export function buildGreetingMessage(firstName: string): string {
  return (
    `👋 *Xin chào ${firstName}! Chào mừng bạn đến với Sophia AI Factory.* 🚀\n\n` +
    `Cỗ máy tự động hóa sản xuất video ngắn viral dành riêng cho **Solopreneurs, Nhà sáng lập & E-commerce**:\n` +
    `✨ Tự động tạo 100+ video ngắn mỗi tháng (TikTok, Shorts, Reels)\n` +
    `✨ AI Avatar giống người thật 99% + Giọng đọc tiếng Việt/Anh chuẩn Studio\n` +
    `✨ Tiết kiệm 85% chi phí quay dựng truyền thống\n\n` +
    `👇 *Chọn lĩnh vực của bạn để nhận ngay Video Demo mẫu thiết kế riêng (miễn phí):*`
  );
}

export function buildBudgetPromptMessage(): string {
  return (
    `📊 *Mục tiêu và quy mô sản xuất video hàng tháng của bạn là gì?*\n\n` +
    `Chọn mức ngân sách & tần suất sản xuất dự kiến để Sophia gợi ý gói giải pháp & tối ưu kịch bản:`
  );
}

export function buildSampleVideoCaption(sampleVideo: SampleVideoItem): string {
  return (
    `🎬 *Video AI Mẫu cho ngành ${sampleVideo.nicheNameVi}*\n\n` +
    `⏱️ Thời gian tạo: ${sampleVideo.durationSec} giây\n` +
    `🎙️ Giọng đọc AI tự nhiên chuẩn studio tiếng Việt/Anh\n` +
    `📈 Tỷ lệ giữ chân người xem trung bình: ${sampleVideo.retentionRate}\n` +
    `💡 Chi phí truyền thống: ${sampleVideo.traditionalCost} ➔ Với Sophia: chỉ từ ${sampleVideo.sophiaCost}/video!`
  );
}

export function buildSolo100OfferMessage(): string {
  return (
    `🎁 *ƯU ĐÃI ĐỘC QUYỀN: MÃ GIẢM GIÁ SOLO100*\n\n` +
    `Dành riêng cho 10 khách hàng đầu tiên tham gia thử nghiệm Cỗ máy Tăng trưởng:\n` +
    `🔥 Giảm ngay *$100/tháng* cho gói Starter ($199/tháng ➔ chỉ còn *$99/tháng* ~ 2.475.000đ)\n` +
    `🔥 Tự động sản xuất lên tới 30 video ngắn AI chất lượng 1080p/tháng\n` +
    `🔥 Kèm trọn bộ 100+ Hook Scripts viral chuyển đổi cao\n\n` +
    `Chọn phương thức thanh toán trực tiếp bên dưới để kích hoạt ngay:`
  );
}
