-- Migration 0112: Help videos catalog table + 10 placeholder seed rows
-- Videos are published=0 by default until founder uploads to R2

CREATE TABLE IF NOT EXISTS help_videos (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title_en TEXT NOT NULL,
  title_vi TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_vi TEXT NOT NULL,
  r2_key TEXT,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  order_index INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_help_videos_category ON help_videos (category);
CREATE INDEX IF NOT EXISTS idx_help_videos_order ON help_videos (order_index);

-- Seed: 10 placeholder entries (all published=0 until founder uploads)
INSERT OR IGNORE INTO help_videos (id, slug, title_en, title_vi, description_en, description_vi, r2_key, duration_sec, category, order_index, published) VALUES
  ('hv_01', 'welcome',                 'Welcome to Sophia AI Factory',       'Chào mừng đến Sophia AI Factory',         'Overview of the platform and what you can build.',                               'Tổng quan về nền tảng và những gì bạn có thể xây dựng.',                           NULL, 90,  'getting-started', 1, 0),
  ('hv_02', 'connect-first-affiliate', 'Connect Your First Affiliate',        'Kết nối đối tác đầu tiên',                 'Step-by-step: add an affiliate network and approve your first partner.',          'Từng bước: thêm mạng lưới affiliate và phê duyệt đối tác đầu tiên.',              NULL, 120, 'integrations',    2, 0),
  ('hv_03', 'setup-byok-keys',         'Set Up Your API Keys (BYOK)',         'Cấu hình khóa API của bạn (BYOK)',         'Add OpenRouter, ElevenLabs, and D-ID keys so Sophia uses your own quota.',        'Thêm khóa OpenRouter, ElevenLabs và D-ID để Sophia dùng quota của bạn.',           NULL, 90,  'setup',           3, 0),
  ('hv_04', 'create-first-video',      'Create Your First AI Video',          'Tạo video AI đầu tiên',
    'Use a SOP template to generate a short marketing video in under 5 minutes.',   'Dùng mẫu SOP để tạo video marketing ngắn trong dưới 5 phút.',                      NULL, 300, 'content',         4, 0),
  ('hv_05', 'publish-to-bundle',       'Publish to Your Bundle',              'Xuất bản vào gói của bạn',                 'Schedule and publish content to your affiliate distribution bundle.',             'Lên lịch và xuất bản nội dung vào gói phân phối affiliate của bạn.',               NULL, 120, 'content',         5, 0),
  ('hv_06', 'read-revenue-dashboard',  'Read the Revenue Dashboard',          'Đọc bảng điều khiển doanh thu',            'Understand commissions, credits, and payouts on the analytics page.',            'Hiểu hoa hồng, credits và thanh toán trên trang phân tích.',                       NULL, 90,  'analytics',       6, 0),
  ('hv_07', 'crypto-compliance',       'Crypto Compliance Basics',            'Cơ bản về tuân thủ crypto',                'Required steps for crypto payouts: jurisdiction, KYC, and tax implications.',    'Các bước cần thiết cho thanh toán crypto: khu vực pháp lý, KYC và thuế.',          NULL, 150, 'compliance',      7, 0),
  ('hv_08', 'ab-experiments',          'Run A/B Experiments',                 'Chạy thử nghiệm A/B',                      'Test different headlines and thumbnails to maximize affiliate conversions.',       'Thử nghiệm tiêu đề và hình thu nhỏ để tối đa hóa chuyển đổi affiliate.',           NULL, 120, 'advanced',        8, 0),
  ('hv_09', 'cooldown-best-practices', 'Cooldown & Posting Best Practices',   'Thực hành tốt nhất về cooldown & đăng bài','Avoid account bans by spacing posts correctly across channels.',                   'Tránh bị ban tài khoản bằng cách đăng bài đúng khoảng cách trên các kênh.',        NULL, 90,  'advanced',        9, 0),
  ('hv_10', 'troubleshooting',         'Troubleshooting Common Issues',       'Khắc phục các sự cố thường gặp',          'Fix magic link failures, stuck videos, Telegram bot errors, and more.',          'Sửa lỗi magic link, video bị kẹt, lỗi Telegram bot và nhiều hơn nữa.',             NULL, 180, 'support',        10, 0);
