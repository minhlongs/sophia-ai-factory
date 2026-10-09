/**
 * Customer Retention Win-Back Email Template & Dispatcher.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/email-notifier
 */

import { sendEmail } from '@/tree/email/sender';
import { logger } from '@/seed/utils/logger-utility';
import { escapeHtml } from './constants';
import type { CustomerHealthMetrics } from './types';

/**
 * Sends targeted bilingual win-back email via Resend.
 */
export async function sendWinBackEmail(
  customer: CustomerHealthMetrics,
): Promise<boolean> {
  try {
    const greetingName = escapeHtml(
      customer.userName || customer.userEmail.split('@')[0],
    );
    const emailResult = await sendEmail({
      to: customer.userEmail,
      subject: 'Sophia AI: We miss you! / Chúng tôi có thể hỗ trợ gì cho bạn?',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #18181b;">
          <h2 style="color: #0f172a; margin-bottom: 16px;">We noticed you have been away / Chúng tôi nhận thấy bạn đã vắng mặt</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #3f3f46;">
            Xin chào <strong>${greetingName}</strong>,<br/><br/>
            Hệ thống Sophia AI nhận thấy chiến dịch tạo video tự động của bạn đang tạm lắng trong vài ngày qua.
            Đội ngũ Sophia luôn sẵn sàng hỗ trợ bạn tối ưu kịch bản viral, kết nối kênh mạng xã hội, hoặc giải quyết bất kỳ vướng mắc kỹ thuật nào.
          </p>
          <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #52525b;">
              💡 <strong>Mẹo nhỏ hôm nay:</strong> Chỉ cần chọn mẫu kịch bản "Bán hàng E-Commerce" và bấm Tạo Video, Trợ lý AI sẽ tự động phân phối lên TikTok & Reels cho bạn trong 3 phút.
            </p>
          </div>
          <p style="text-align: center; margin: 30px 0;">
            <a href="https://sophia.agencyos.network/dashboard" style="background-color: #059669; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
              Quay lại Bảng điều khiển / Return to Dashboard
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="font-size: 12px; color: #a1a1aa; line-height: 1.5;">
            Sophia AI Factory • Autonomous Video Generation & Growth Engine<br/>
            Nếu bạn cần hỗ trợ trực tiếp từ Founder, chỉ cần phản hồi lại email này.
          </p>
        </div>
      `,
    });
    return emailResult.success;
  } catch (err) {
    logger.warn('[CustomerRetentionService] win-back email dispatch failed', {
      userId: customer.userId,
      err: String(err),
    });
    return false;
  }
}
