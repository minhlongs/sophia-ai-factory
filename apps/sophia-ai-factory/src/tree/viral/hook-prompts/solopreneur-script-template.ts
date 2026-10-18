/**
 * @file solopreneur-script-template.ts
 * @description Deterministic solopreneur viral video script template.
 * @layer tree
 */

import type { ScriptTemplateData } from './types';

export const SOLOPRENEUR_SCRIPT_TEMPLATE: ScriptTemplateData = {
  hookId: 'hook_solo_curiosity',
  niche: 'solopreneur',
  title: 'The Faceless $5,000/mo Solopreneur Playbook',
  titleVi: 'Chiến Lược Kinh Doanh Không Lộ Mặt $5.000/Tháng',
  ctaText: 'Start your automated 1-person revenue engine on Telegram with code SOLO100.',
  ctaTextVi: 'Khởi động cỗ máy doanh thu 1 người trên Telegram với mã ưu đãi SOLO100.',
  sections: [
    {
      section: 'hook',
      narration: 'How I scaled a 1-person software business to $5,000 MRR without ever showing my face.',
      narrationVi: 'Cách tôi đưa doanh nghiệp 1 người cán mốc $5.000 MRR mà không cần lộ mặt lấy một giây.',
      visualCue: 'Hooded creator typing on MacBook in coffee shop, revenue dashboard shown on screen',
      onScreenText: '$5,000 MRR FACELESS PLAYBOOK 🤫',
      durationSec: 4,
    },
    {
      section: 'problem',
      narration: 'Everyone tells you to be an influencer and film yourself 24/7. But you have a job and zero time to edit.',
      narrationVi: 'Mọi người khuyên bạn phải làm influencer và quay mặt cả ngày. Nhưng bạn bận đi làm và không có thời gian.',
      visualCue: 'Overwhelmed creator staring at complicated Premiere Pro timeline',
      onScreenText: 'You don’t need to be an influencer 🙅‍♂️',
      durationSec: 7,
    },
    {
      section: 'solution',
      narration: 'I use Sophia AI Factory to turn trending problems into faceless shorts, driving traffic directly into an automated sales bot.',
      narrationVi: 'Tôi dùng Sophia AI Factory chuyển các vấn đề hot thành video ngắn tự động, kéo traffic thẳng vào bot bán hàng.',
      visualCue: 'Diagram showing Viral Video ➔ Telegram Bot ➔ Instant Checkout',
      onScreenText: 'Viral Video ➔ Sales Bot ➔ MRR ⚙️',
      durationSec: 10,
    },
    {
      section: 'proof',
      narration: 'It converts visitors into paying subscribers 24/7 while I sleep. 100% passive leverage.',
      narrationVi: 'Hệ thống chốt đơn tự động 24/7 ngay cả khi tôi đang ngủ. Đòn bẩy tự do tài chính thực thụ.',
      visualCue: 'Payment notifications from NOWPayments and PayOS ticking in',
      onScreenText: 'Real Passive Leverage 🌟',
      durationSec: 4,
    },
    {
      section: 'cta',
      narration: 'Send a message to our Telegram bot to see the live demo and get $100 off.',
      narrationVi: 'Nhắn tin cho bot Telegram của chúng tôi để xem demo trực tiếp và nhận ưu đãi $100.',
      visualCue: 'Telegram app opening with exclusive discount code SOLO100 highlighted',
      onScreenText: '👉 CHAT WITH BOT @Sophia_Bbot',
      durationSec: 5,
    },
  ],
};
