/**
 * @file script-templates.ts
 * @description Deterministic high-retention video script templates.
 * @layer tree
 */

import type { ScriptTemplateData } from './types';
import { SOLOPRENEUR_SCRIPT_TEMPLATE } from './solopreneur-script-template';

export const DETERMINISTIC_SCRIPT_TEMPLATES: ScriptTemplateData[] = [
  {
    hookId: 'hook_ai_curiosity',
    niche: 'ai_automation',
    title: 'The AI Agency Secret That Saves $8,000/mo',
    titleVi: 'Bí Mật AI Giúp Agency Tiết Kiệm 180 Triệu/Tháng',
    ctaText: 'Test the autonomous viral pipeline at the link in bio or tap Telegram below.',
    ctaTextVi: 'Trải nghiệm hệ thống AI viral tự động tại link bio hoặc bấm Telegram bên dưới.',
    sections: [
      {
        section: 'hook',
        narration: 'Most marketing agencies are hiding this one AI workflow from their clients...',
        narrationVi: 'Hầu hết các agency marketing đang giấu khách hàng quy trình tự động hóa AI này...',
        visualCue: 'Fast zoom on laptop screen showing multi-agent terminal workflow',
        onScreenText: 'WHAT AGENCIES HIDE FROM YOU 🤫',
        durationSec: 3,
      },
      {
        section: 'problem',
        narration: 'They charge you thousands for monthly content retainers, while secretly batching everything in minutes.',
        narrationVi: 'Họ tính bạn hàng chục triệu chi phí quản trị mỗi tháng, nhưng thực tế xử lý xong chỉ trong vài phút.',
        visualCue: 'Invoice graphic with $5,000 crossed out',
        onScreenText: 'Stop paying manual retainers 💸',
        durationSec: 7,
      },
      {
        section: 'solution',
        narration: 'Sophia AI Factory connects trending hook discovery with automated video synthesis and multi-channel publishing.',
        narrationVi: 'Sophia AI Factory kết nối tìm kiếm hook xu hướng với tự động dựng video và đăng đa nền tảng.',
        visualCue: 'Quick montage of Sophia AI Factory dashboard dispatching video to TikTok and YouTube',
        onScreenText: 'Sophia AI Factory = 24/7 Production ⚡',
        durationSec: 10,
      },
      {
        section: 'proof',
        narration: 'Over 120 agencies are already cutting operating costs by 70% and scaling to $20K MRR.',
        narrationVi: 'Hơn 120 agency đã cắt giảm 70% chi phí vận hành và nâng doanh thu lên hàng chục nghìn đô.',
        visualCue: 'Metrics graph shooting upward with green line',
        onScreenText: '70% Cost Cut • 10x Output 📈',
        durationSec: 5,
      },
      {
        section: 'cta',
        narration: 'Claim your 100-video test pilot on Telegram right now. Link in bio!',
        narrationVi: 'Nhận ngay gói trải nghiệm 100 video qua Telegram ngay hôm nay. Link ở phần tiểu sử!',
        visualCue: 'Pointing finger to link sticker with Telegram icon pulsing',
        onScreenText: '👉 TAP LINK IN BIO / TELEGRAM BOT',
        durationSec: 5,
      },
    ],
  },
  {
    hookId: 'hook_ecom_problem_solution',
    niche: 'ecommerce',
    title: 'How 15s AI Product Videos Sell Out Warehouses',
    titleVi: 'Cách Video AI 15s Giúp Bán Hết Sạch Kho Hàng',
    ctaText: 'Generate your first 5 high-converting product videos for free today.',
    ctaTextVi: 'Tự động tạo 5 video sản phẩm chuyển đổi cao đầu tiên hoàn toàn miễn phí.',
    sections: [
      {
        section: 'hook',
        narration: 'Shoppers scroll past boring product photos. But this 15-second AI video demo sold out our warehouse.',
        narrationVi: 'Khách hàng lướt qua ảnh sản phẩm nhàm chán. Nhưng video AI trải nghiệm 15 giây này đã bán sạch kho hàng.',
        visualCue: 'Split screen: boring static photo vs dynamic 3D unboxing demo',
        onScreenText: 'STATIC PHOTO vs VIRAL AI VIDEO 🔥',
        durationSec: 4,
      },
      {
        section: 'problem',
        narration: 'Hiring video creators costs $200 a pop and takes two weeks. By the time you post, the trend is dead.',
        narrationVi: 'Thuê KOC quay tốn vài triệu một video và mất 2 tuần. Đến lúc nhận video thì xu hướng đã qua.',
        visualCue: 'Calendar tearing pages fast with red X marks',
        onScreenText: 'Slow UGC Kills Sales ⏳',
        durationSec: 6,
      },
      {
        section: 'solution',
        narration: 'With Sophia AI, drop your product link or photo, and get 20 UGC-style viral videos ready for TikTok Shop in 60 seconds.',
        narrationVi: 'Với Sophia AI, chỉ cần dán link hoặc ảnh sản phẩm, nhận ngay 20 video UGC chuẩn TikTok Shop chỉ sau 60 giây.',
        visualCue: 'Product photo transforming into energetic TikTok video with captions & trending audio',
        onScreenText: 'Paste Link ➔ 20 Viral Videos 🚀',
        durationSec: 10,
      },
      {
        section: 'proof',
        narration: 'Average store ROAS jumped from 1.8x to 5.4x within 7 days of switching.',
        narrationVi: 'ROAS trung bình của các shop tăng vọt từ 1.8 lên 5.4 chỉ sau 7 ngày áp dụng.',
        visualCue: 'Shopify / TikTok Shop revenue notification banner popping up',
        onScreenText: '1.8x ➔ 5.4x ROAS Boost 💰',
        durationSec: 5,
      },
      {
        section: 'cta',
        narration: 'Tap the link in bio to deploy your automated product video factory now.',
        narrationVi: 'Bấm link ở bio để kích hoạt nhà máy sản xuất video sản phẩm của bạn ngay.',
        visualCue: 'Arrow pointing to TikTok bio with special coupon SOLO100',
        onScreenText: '👉 GET STARTED IN BIO / TELEGRAM',
        durationSec: 5,
      },
    ],
  },
  SOLOPRENEUR_SCRIPT_TEMPLATE,
];
