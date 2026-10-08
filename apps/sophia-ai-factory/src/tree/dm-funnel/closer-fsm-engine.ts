/**
 * @file closer-fsm-engine.ts
 * @description Finite State Machine for Conversational Affiliate Closer
 * @layer tree
 */

import type { FunnelState } from '@/seed/types/live-stream-newsjack-dm-types';

export interface CloserDialogueState {
  currentState: FunnelState;
  nextState: FunnelState;
  replyMessage: string;
  affiliateUrlToSend: string | null;
  optedOut: boolean;
}

/**
 * Executes state transitions based on inbound message and lead history.
 */
export function transitionCloserState(
  currentState: FunnelState,
  inboundMessage: string,
  baseAffiliateUrl: string,
  subId: string,
): CloserDialogueState {
  const msgLower = inboundMessage.toLowerCase().trim();

  // Handle opt-out keywords
  if (msgLower === 'stop' || msgLower === 'huỷ' || msgLower === 'ngưng') {
    return {
      currentState,
      nextState: 'OPTED_OUT',
      replyMessage: 'Dạ mình đã ngưng gửi thông báo cho bạn. Cảm ơn bạn rất nhiều ạ!',
      affiliateUrlToSend: null,
      optedOut: true,
    };
  }

  const trackedUrl = `${baseAffiliateUrl}?sub_id=${subId}&utm_source=dm_closer&utm_medium=auto`;

  switch (currentState) {
    case 'NEW':
      return {
        currentState,
        nextState: 'QUALIFIED',
        replyMessage: 'Dạ chào bạn! Cảm ơn bạn đã quan tâm. Bạn đang muốn tìm dòng sản phẩm cho nhu cầu cá nhân hay công việc ạ?',
        affiliateUrlToSend: null,
        optedOut: false,
      };

    case 'QUALIFIED':
      return {
        currentState,
        nextState: 'LINK_SENT',
        replyMessage: `Dạ tuyệt vời! Đúng dịp bên mình đang có mã voucher độc quyền. Bạn xem chi tiết tại link này nha: ${trackedUrl}`,
        affiliateUrlToSend: trackedUrl,
        optedOut: false,
      };

    case 'LINK_SENT':
      if (msgLower.includes('đắt') || msgLower.includes('chưa mua') || msgLower.includes('phân vân')) {
        return {
          currentState,
          nextState: 'LINK_SENT',
          replyMessage: 'Dạ mức giá này đã bao gồm bảo hành 12 tháng chính hãng và voucher giảm 20% chỉ còn hiệu lực trong hôm nay thôi ạ!',
          affiliateUrlToSend: trackedUrl,
          optedOut: false,
        };
      }
      return {
        currentState,
        nextState: 'CLICKED',
        replyMessage: 'Dạ bạn cần mình hỗ trợ thêm bước đặt hàng hay chọn size/màu nào không ạ?',
        affiliateUrlToSend: null,
        optedOut: false,
      };

    default:
      return {
        currentState,
        nextState: currentState,
        replyMessage: 'Dạ đội ngũ bên mình sẽ hỗ trợ bạn ngay khi có thêm thông tin nha!',
        affiliateUrlToSend: null,
        optedOut: false,
      };
  }
}
