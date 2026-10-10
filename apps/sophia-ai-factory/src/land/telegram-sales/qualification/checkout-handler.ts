/**
 * Lead Checkout Handler
 * Layer: land/telegram-sales
 */

import { logger } from '@/seed/utils/logger-utility';
import { sendTelegramMessageWithKeyboard } from '@/tree/telegram/telegram-client';
import { buildCheckoutKeyboard } from '@/tree/telegram/telegram-lead-keyboards';
import { calculatePromoDiscount } from '@/land/promo/promo-discount-calculator';
import { recordCheckoutIntent } from '../telegram-lead-repo';
import { createCheckout } from '@/tree/clients/nowpayments-client';
import { createPayOsInvoice, FEATURE_PAYOS } from '@/land/payments/payos';

/**
 * Handles automated checkout trigger (NOWPayments USDT or PayOS VietQR).
 */
export async function handleCheckoutTrigger(
  chatId: string,
  provider: 'nowpayments' | 'payos',
  tier: 'BASIC' | 'PREMIUM' = 'BASIC',
  promoCode = 'SOLO100',
): Promise<void> {
  const orderId = `sophia_tg_${chatId.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;
  await recordCheckoutIntent(chatId, provider, orderId);

  const discount = calculatePromoDiscount(tier, promoCode);

  if (provider === 'payos') {
    const formattedVnd = discount.finalVnd.toLocaleString('vi-VN');
    let checkoutUrl: string | undefined;

    if (FEATURE_PAYOS) {
      try {
        const payosResult = await createPayOsInvoice({
          tier,
          period: 'monthly',
          userId: `tg_${chatId}`,
          orderId,
          amountVndOverride: discount.finalVnd,
        });
        checkoutUrl = payosResult.checkoutUrl;
      } catch (err) {
        logger.warn(
          '[qualification-service] PayOS API invoice generation failed (falling back to payment instructions)',
          {
            error: String(err),
            orderId,
          },
        );
      }
    }

    const payosMessage =
      `💳 *THANH TOÁN VIETQR (PAYOS) — GÓI ${tier}*\n\n` +
      `• Gói đăng ký: *Sophia AI Factory ${tier}*\n` +
      `• Giá gốc: $199/tháng (4.975.000đ)\n` +
      `• Ưu đãi độc quyền (${promoCode}): *-$100 (Đã giảm 2.500.000đ)*\n` +
      `• Số tiền thanh toán: *${formattedVnd} VNĐ*\n` +
      `• Mã đơn hàng: \`${orderId}\`\n\n` +
      `_Nhấn nút bên dưới để mở giao diện quét mã VietQR tự động:_`;

    await sendTelegramMessageWithKeyboard(
      chatId,
      payosMessage,
      buildCheckoutKeyboard({ payosUrl: checkoutUrl }),
    );
    return;
  }

  if (provider === 'nowpayments') {
    let checkoutUrl: string | undefined;

    try {
      const nowpaymentsResult = await createCheckout({
        tierId: tier,
        userId: `tg_${chatId}`,
        orderId,
        priceAmountOverride: discount.finalUsd,
      });
      checkoutUrl = nowpaymentsResult.invoiceUrl;
    } catch (err) {
      logger.warn(
        '[qualification-service] NOWPayments createCheckout failed (falling back to direct base link)',
        {
          error: String(err),
          orderId,
        },
      );
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';
      checkoutUrl = `${appUrl}/pricing?promo=${promoCode}&tier=${tier}`;
    }

    const nowpaymentsMessage =
      `🪙 *THANH TOÁN CRYPTO USDT (NOWPAYMENTS) — GÓI ${tier}*\n\n` +
      `• Gói đăng ký: *Sophia AI Factory ${tier}*\n` +
      `• Giá gốc: $199/tháng\n` +
      `• Ưu đãi (${promoCode}): *-$100*\n` +
      `• *Số tiền thanh toán: ${discount.finalUsd} USDT*\n` +
      `• Mạng lưới: TRC20 / BEP20 / Polygon\n` +
      `• Mã đơn hàng: \`${orderId}\`\n\n` +
      `_Nhấn nút bên dưới để chuyển đến cổng thanh toán bảo mật NOWPayments:_`;

    await sendTelegramMessageWithKeyboard(
      chatId,
      nowpaymentsMessage,
      buildCheckoutKeyboard({ nowpaymentsUrl: checkoutUrl }),
    );
  }
}
