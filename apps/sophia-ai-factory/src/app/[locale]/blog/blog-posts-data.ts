/**
 * Blog posts data.
 * Layer: app/[locale]/blog
 * @module app/[locale]/blog/blog-posts-data
 */

export interface BlogPost {
  slug: string;
  href: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
}

export const POSTS: BlogPost[] = [
  {
    slug: 'getting-started',
    href: '/guide/how-it-works',
    title: 'Hướng Dẫn Bắt Đầu Với Sophia AI Factory',
    excerpt:
      'Tạo video AI đầu tiên của bạn trong 5 phút — không cần kỹ thuật.',
    date: '2026-04-15',
    readTime: '3 phút',
  },
  {
    slug: 'telegram-bot-tips',
    href: '/guide/telegram',
    title: '5 Mẹo Sử Dụng Telegram Bot Hiệu Quả',
    excerpt:
      'Tạo video từ điện thoại, theo dõi tiến độ, và nhận thông báo tự động.',
    date: '2026-04-14',
    readTime: '4 phút',
  },
  {
    slug: 'affiliate-video-strategy',
    href: '/guide/how-it-works',
    title: 'Chiến Lược Video Affiliate: Từ 0 → $1000/Tháng',
    excerpt:
      'Cách chọn sản phẩm, viết kịch bản AI, và tối ưu kênh YouTube faceless.',
    date: '2026-04-12',
    readTime: '6 phút',
  },
  {
    slug: 'non-tech-ceos-ai-video',
    href: '/guide/how-it-works',
    title: 'How Non-Tech CEOs Use AI to Create Video Content — Cách CEO Không Kỹ Thuật Dùng AI Tạo Video',
    excerpt:
      'No cameras, no editors, no video experience needed. See how business owners are publishing daily AI videos with zero technical skills.',
    date: '2026-05-01',
    readTime: '5 min',
  },
  {
    slug: 'affiliate-passive-income',
    href: '/affiliate',
    title: '5 Ways to Earn Passive Income with Sophia Affiliate Program — 5 Cách Kiếm Thu Nhập Thụ Động',
    excerpt:
      'Earn 70% commission on every referral. Share your link on YouTube, Telegram, blog posts, or social media — get paid in USDT every month.',
    date: '2026-05-05',
    readTime: '4 min',
  },
  {
    slug: 'usdt-payments-guide',
    href: '/guide/faq',
    title: 'USDT Payments Explained: A Simple Guide for Business Owners — Hướng Dẫn USDT Đơn Giản',
    excerpt:
      'What is USDT, how to buy it, which network to use, and how to pay for Sophia subscription in under 5 minutes.',
    date: '2026-05-10',
    readTime: '5 min',
  },
  {
    slug: 'first-week-with-sophia',
    href: '/guide/how-it-works',
    title: 'From Zero to Revenue: Your First Week with Sophia — Tuần Đầu Tiên Với Sophia',
    excerpt:
      'Day-by-day onboarding guide: set up API keys, create your first campaign, publish to YouTube, and earn your first affiliate commission.',
    date: '2026-05-15',
    readTime: '6 min',
  },
  {
    slug: 'hybrid-scene-graph-zero-hallucination-video',
    href: '/guide/how-it-works',
    title: 'Hybrid Scene-Graph 2027: Video AI Sắc Nét 0% Sai Số Liệu (Edge SVG Data Cards)',
    excerpt:
      'Kết hợp Hook 3s điện ảnh (fal.ai/Replicate), bảng số liệu SVG sắc nét 0% lỗi chữ, Avatar thuyết trình và thẻ tuân thủ pháp lý tự động.',
    date: '2026-10-26',
    readTime: '6 min',
  },
  {
    slug: '10-affiliate-networks-cex-saas-ltv-blueprint',
    href: '/affiliate',
    title: 'Chiến Lược 10 Mạng Affiliate: Ghép Cặp Hoa Hồng CEX (Binance, Bybit, OKX) & B2B SaaS MRR',
    excerpt:
      'Xây dựng nguồn thu nhập kép từ hoàn phí giao dịch CEX và hoa hồng phần mềm định kỳ hàng tháng trên 10 mạng lưới toàn cầu.',
    date: '2026-10-26',
    readTime: '7 min',
  },
];