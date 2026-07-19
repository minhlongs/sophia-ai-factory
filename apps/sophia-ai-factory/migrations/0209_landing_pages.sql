-- Migration 0209: Landing Pages table for programmatic SEO
-- Creates the landing_pages table + seeds 15 default niches with bilingual content.
-- Idempotent: uses CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, INSERT OR IGNORE.

CREATE TABLE IF NOT EXISTS landing_pages (
  id TEXT PRIMARY KEY,           -- slug: "real-estate"
  niche_label TEXT NOT NULL,     -- "Real Estate / Bất Động Sản"
  hero_title_en TEXT,            -- English hero headline
  hero_title_vi TEXT,            -- Vietnamese hero headline
  hero_sub_en TEXT,              -- English hero subtitle
  hero_sub_vi TEXT,              -- Vietnamese hero subtitle
  features_json TEXT,            -- JSON array of { icon, title_en, title_vi, desc_en, desc_vi }
  faq_json TEXT,                 -- JSON array of { question_en, question_vi, answer_en, answer_vi }
  meta_title_en TEXT,            -- SEO title EN
  meta_title_vi TEXT,            -- SEO title VI
  meta_desc_en TEXT,             -- SEO description EN
  meta_desc_vi TEXT,             -- SEO description VI
  is_published INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_landing_pages_published ON landing_pages(is_published);

-- ── Seed 15 niches ──────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'real-estate',
  'Real Estate / Bất Động Sản',
  'AI Videos for Real Estate Marketing',
  'Video AI Cho Tiếp Thị Bất Động Sản',
  'Showcase properties with stunning AI-generated videos that sell faster.',
  'Giới thiệu bất động sản với video AI ấn tượng giúp bán nhanh hơn.',
  '[{"icon":"home","title_en":"Virtual Tours","title_vi":"Tham Quan Ảo","desc_en":"Turn property photos into walkthrough videos automatically.","desc_vi":"Biến ảnh bất động sản thành video tham quan tự động."},{"icon":"users","title_en":"Agent Branding","title_vi":"Thương Hiệu Môi Giới","desc_en":"Create personal brand videos that build trust with buyers.","desc_vi":"Tạo video thương hiệu cá nhân xây dựng niềm tin với người mua."},{"icon":"map-pin","title_en":"Neighborhood Highlights","title_vi":"Điểm Nổi Bật Khu Vực","desc_en":"Showcase local amenities and lifestyle in video format.","desc_vi":"Giới thiệu tiện ích địa phương và phong cách sống qua video."},{"icon":"trending-up","title_en":"Market Updates","title_vi":"Cập Nhật Thị Trường","desc_en":"Share weekly market trends with AI-narrated video reports.","desc_vi":"Chia sẻ xu hướng thị trường hàng tuần với video tường thuật AI."}]',
  '[{"question_en":"Can AI videos really help sell properties?","question_vi":"Video AI có thực sự giúp bán bất động sản?","answer_en":"Yes — listings with video get 403% more inquiries. AI videos let you create professional walkthroughs in minutes instead of hiring expensive production crews.","answer_vi":"Có — tin đăng có video nhận được nhiều hơn 403% lượt hỏi thăm. Video AI cho phép bạn tạo video chuyên nghiệp trong vài phút thay vì thuê đội quay phim đắt đỏ."},{"question_en":"Do I need video editing skills?","question_vi":"Tôi có cần kỹ năng chỉnh sửa video không?","answer_en":"Not at all. You describe the property, Sophia generates the script, voiceover, and video — all automated.","answer_vi":"Hoàn toàn không. Bạn mô tả bất động sản, Sophia tạo kịch bản, giọng đọc và video — tất cả tự động."},{"question_en":"What types of real estate videos can I create?","question_vi":"Tôi có thể tạo những loại video bất động sản nào?","answer_en":"Property tours, agent introductions, neighborhood guides, market updates, open house invitations, and testimonial videos.","answer_vi":"Video tham quan, giới thiệu môi giới, hướng dẫn khu vực, cập nhật thị trường, thư mời xem nhà và video đánh giá khách hàng."}]',
  'AI Video for Real Estate Agents | Virtual Property Tours',
  'Video AI Cho Môi Giới Bất Động Sản | Tham Quan Ảo',
  'Create professional AI-generated real estate videos in minutes. Virtual tours, agent branding, and market updates — no editing skills needed.',
  'Tạo video bất động sản chuyên nghiệp bằng AI trong vài phút. Tham quan ảo, thương hiệu môi giới và cập nhật thị trường — không cần kỹ năng chỉnh sửa.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'e-commerce',
  'E-Commerce / Thương Mại Điện Tử',
  'AI Product Videos for E-Commerce',
  'Video Sản Phẩm AI Cho Thương Mại Điện Tử',
  'Boost conversion rates with AI-generated product demo videos that sell 24/7.',
  'Tăng tỷ lệ chuyển đổi với video demo sản phẩm AI bán hàng 24/7.',
  '[{"icon":"shopping-cart","title_en":"Product Demos","title_vi":"Demo Sản Phẩm","desc_en":"Turn product photos and descriptions into compelling demo videos.","desc_vi":"Biến ảnh và mô tả sản phẩm thành video demo hấp dẫn."},{"icon":"smartphone","title_en":"Social Ads","title_vi":"Quảng Cáo MXH","desc_en":"Create vertical video ads optimized for TikTok, Reels, and Shorts.","desc_vi":"Tạo video quảng cáo dọc tối ưu cho TikTok, Reels và Shorts."},{"icon":"repeat","title_en":"Bulk Generation","title_vi":"Tạo Hàng Loạt","desc_en":"Generate videos for your entire catalog — hundreds of SKUs at once.","desc_vi":"Tạo video cho toàn bộ danh mục — hàng trăm SKU cùng lúc."},{"icon":"bar-chart","title_en":"A/B Testing","title_vi":"Thử Nghiệm A/B","desc_en":"Test different video styles to find what converts best.","desc_vi":"Thử nghiệm các phong cách video khác nhau để tìm ra cái chuyển đổi tốt nhất."}]',
  '[{"question_en":"Can AI videos replace traditional product photography?","question_vi":"Video AI có thể thay thế chụp ảnh sản phẩm truyền thống không?","answer_en":"AI videos complement your product photos by bringing them to life with motion, voiceover, and text overlays. Many sellers see 30-80% higher conversion rates on listings with video.","answer_vi":"Video AI bổ sung cho ảnh sản phẩm bằng cách làm chúng sống động với chuyển động, giọng đọc và chữ phủ. Nhiều người bán thấy tỷ lệ chuyển đổi cao hơn 30-80% trên tin đăng có video."},{"question_en":"How fast can I create a product video?","question_vi":"Tôi có thể tạo video sản phẩm nhanh như thế nào?","answer_en":"Under 5 minutes per product. Paste your product listing URL or description, and Sophia handles the rest.","answer_vi":"Dưới 5 phút mỗi sản phẩm. Dán URL hoặc mô tả sản phẩm, Sophia xử lý phần còn lại."},{"question_en":"What platforms can I use the videos on?","question_vi":"Tôi có thể sử dụng video trên những nền tảng nào?","answer_en":"Shopee, Lazada, TikTok Shop, Amazon, your own Shopify store — anywhere that supports video uploads.","answer_vi":"Shopee, Lazada, TikTok Shop, Amazon, cửa hàng Shopify của bạn — bất kỳ đâu hỗ trợ tải lên video."}]',
  'AI Product Videos for E-Commerce | Boost Conversion Rates',
  'Video Sản Phẩm AI Cho Thương Mại Điện Tử | Tăng Tỷ Lệ Chuyển Đổi',
  'Create AI-generated product demo videos for your e-commerce store. Boost conversions by 30-80% — no filming or editing required.',
  'Tạo video demo sản phẩm bằng AI cho cửa hàng thương mại điện tử. Tăng chuyển đổi 30-80% — không cần quay phim hay chỉnh sửa.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'crypto',
  'Crypto / Tiền Mã Hóa',
  'AI Videos for Crypto & Web3 Projects',
  'Video AI Cho Dự Án Crypto & Web3',
  'Explain tokenomics, roadmaps, and project vision with AI-generated videos.',
  'Giải thích tokenomics, lộ trình và tầm nhìn dự án với video AI.',
  '[{"icon":"coins","title_en":"Token Explainers","title_vi":"Giải Thích Token","desc_en":"Break down complex tokenomics into simple animated explainer videos.","desc_vi":"Phân tích tokenomics phức tạp thành video giải thích hoạt hình đơn giản."},{"icon":"rocket","title_en":"Launch Promos","title_vi":"Quảng Bá Ra Mắt","desc_en":"Build hype for IDO, ICO, or token launches with cinematic trailers.","desc_vi":"Tạo sức nóng cho IDO, ICO hoặc ra mắt token với trailer điện ảnh."},{"icon":"message-circle","title_en":"Community Updates","title_vi":"Cập Nhật Cộng Đồng","desc_en":"Keep your community informed with weekly AI video updates.","desc_vi":"Giữ cộng đồng cập nhật với video AI hàng tuần."},{"icon":"shield","title_en":"Security Guides","title_vi":"Hướng Dẫn Bảo Mật","desc_en":"Educate users on wallet safety and best practices with clear video guides.","desc_vi":"Giáo dục người dùng về an toàn ví và thực hành tốt nhất với video hướng dẫn rõ ràng."}]',
  '[{"question_en":"Do AI videos work for technical crypto content?","question_vi":"Video AI có hiệu quả cho nội dung crypto kỹ thuật không?","answer_en":"Absolutely. AI excels at turning complex concepts into visual stories. Tokenomics, consensus mechanisms, and DeFi strategies become much easier to understand as AI-narrated animations.","answer_vi":"Chắc chắn. AI xuất sắc trong việc biến khái niệm phức tạp thành câu chuyện trực quan. Tokenomics, cơ chế đồng thuận và chiến lược DeFi trở nên dễ hiểu hơn nhiều dưới dạng hoạt hình tường thuật AI."},{"question_en":"Can I use my project branding and logo?","question_vi":"Tôi có thể sử dụng thương hiệu và logo dự án của mình không?","answer_en":"Yes — you can customize videos with your logo, brand colors, and project assets for a consistent look.","answer_vi":"Có — bạn có thể tùy chỉnh video với logo, màu thương hiệu và tài sản dự án để có giao diện nhất quán."},{"question_en":"How often should I post crypto content videos?","question_vi":"Tôi nên đăng video nội dung crypto bao lâu một lần?","answer_en":"Successful crypto projects post 2-5 videos per week across Twitter, YouTube, and Telegram. AI makes this volume achievable without a production team.","answer_vi":"Các dự án crypto thành công đăng 2-5 video mỗi tuần trên Twitter, YouTube và Telegram. AI giúp khối lượng này khả thi mà không cần đội sản xuất."}]',
  'AI Videos for Crypto Projects | Token Explainer Videos',
  'Video AI Cho Dự Án Crypto | Video Giải Thích Token',
  'Create AI-generated explainer videos for your crypto or Web3 project. Simplify tokenomics, build community trust, and boost engagement.',
  'Tạo video giải thích bằng AI cho dự án crypto hoặc Web3 của bạn. Đơn giản hóa tokenomics, xây dựng niềm tin cộng đồng và tăng tương tác.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'health',
  'Health / Sức Khỏe',
  'AI Health & Wellness Videos',
  'Video Sức Khỏe & Sống Khỏe Bằng AI',
  'Create educational health content, workout guides, and wellness tips with AI videos.',
  'Tạo nội dung giáo dục sức khỏe, hướng dẫn tập luyện và mẹo sống khỏe với video AI.',
  '[{"icon":"heart","title_en":"Health Education","title_vi":"Giáo Dục Sức Khỏe","desc_en":"Explain medical topics and wellness concepts in accessible video format.","desc_vi":"Giải thích chủ đề y tế và khái niệm sức khỏe dưới dạng video dễ tiếp cận."},{"icon":"dumbbell","title_en":"Workout Videos","title_vi":"Video Tập Luyện","desc_en":"Generate exercise guides and fitness routines with AI narration.","desc_vi":"Tạo hướng dẫn tập thể dục và lịch trình fitness với tường thuật AI."},{"icon":"apple","title_en":"Nutrition Tips","title_vi":"Mẹo Dinh Dưỡng","desc_en":"Share meal plans and nutrition advice through engaging video content.","desc_vi":"Chia sẻ kế hoạch bữa ăn và lời khuyên dinh dưỡng qua nội dung video hấp dẫn."},{"icon":"brain","title_en":"Mental Wellness","title_vi":"Sức Khỏe Tinh Thần","desc_en":"Create calming meditation guides and mindfulness content.","desc_vi":"Tạo hướng dẫn thiền định và nội dung chánh niệm thư giãn."}]',
  '[{"question_en":"Can AI create accurate health information videos?","question_vi":"AI có thể tạo video thông tin sức khỏe chính xác không?","answer_en":"AI videos are great for general wellness education, fitness, and lifestyle content. For medical advice, always have content reviewed by a licensed professional before publishing.","answer_vi":"Video AI rất tốt cho giáo dục sức khỏe tổng quát, fitness và nội dung lối sống. Đối với tư vấn y tế, luôn để chuyên gia được cấp phép xem xét nội dung trước khi đăng."},{"question_en":"What types of health videos perform best?","question_vi":"Loại video sức khỏe nào hoạt động tốt nhất?","answer_en":"Quick tips under 60 seconds, before-and-after transformations, expert interview clips, and recipe/how-to videos consistently get the most engagement.","answer_vi":"Mẹo nhanh dưới 60 giây, video biến đổi trước-sau, clip phỏng vấn chuyên gia và video công thức/hướng dẫn luôn có tương tác cao nhất."},{"question_en":"Do I need to appear on camera?","question_vi":"Tôi có cần xuất hiện trên camera không?","answer_en":"Not at all. AI videos use avatars, animations, and voiceovers — you can build a health channel without ever being on camera.","answer_vi":"Hoàn toàn không. Video AI sử dụng avatar, hoạt hình và giọng đọc — bạn có thể xây dựng kênh sức khỏe mà không cần lên hình."}]',
  'AI Health & Wellness Videos | Fitness, Nutrition, Mental Health',
  'Video Sức Khỏe & Sống Khỏe Bằng AI | Fitness, Dinh Dưỡng, Tinh Thần',
  'Create AI-generated health and wellness videos. Share workout guides, nutrition tips, and mental wellness content — no filming or camera needed.',
  'Tạo video sức khỏe và sống khỏe bằng AI. Chia sẻ hướng dẫn tập luyện, mẹo dinh dưỡng và nội dung sức khỏe tinh thần — không cần quay phim hay lên hình.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'education',
  'Education / Giáo Dục',
  'AI Video Lessons for Education',
  'Bài Giảng Video AI Cho Giáo Dục',
  'Transform any topic into engaging video lessons with AI narration and visuals.',
  'Biến mọi chủ đề thành bài giảng video hấp dẫn với tường thuật và hình ảnh AI.',
  '[{"icon":"book-open","title_en":"Course Creation","title_vi":"Tạo Khóa Học","desc_en":"Turn your curriculum into a complete video course series automatically.","desc_vi":"Biến giáo trình của bạn thành loạt khóa học video hoàn chỉnh tự động."},{"icon":"languages","title_en":"Multi-Language","title_vi":"Đa Ngôn Ngữ","desc_en":"Create lessons in Vietnamese, English, and more — reach global students.","desc_vi":"Tạo bài giảng bằng tiếng Việt, tiếng Anh và nhiều ngôn ngữ khác — tiếp cận học viên toàn cầu."},{"icon":"presentation","title_en":"Slide-to-Video","title_vi":"Slide Sang Video","desc_en":"Convert PowerPoint or Google Slides into narrated video presentations.","desc_vi":"Chuyển đổi PowerPoint hoặc Google Slides thành video thuyết trình có tường thuật."},{"icon":"award","title_en":"Certification Content","title_vi":"Nội Dung Chứng Chỉ","desc_en":"Create professional training and certification prep video content.","desc_vi":"Tạo nội dung video đào tạo chuyên nghiệp và luyện thi chứng chỉ."}]',
  '[{"question_en":"Can AI really replace a teacher on video?","question_vi":"AI có thực sự thay thế được giáo viên trên video không?","answer_en":"AI videos are best as a supplement — they handle repetitive explanations, summaries, and review content so teachers can focus on interactive sessions. They are not a replacement for human instruction.","answer_vi":"Video AI tốt nhất là công cụ bổ trợ — chúng xử lý giải thích lặp lại, tóm tắt và nội dung ôn tập để giáo viên tập trung vào buổi học tương tác. Chúng không thay thế giảng dạy của con người."},{"question_en":"What subjects work best with AI video lessons?","question_vi":"Những môn học nào phù hợp nhất với bài giảng video AI?","answer_en":"Language learning, math tutorials, science concepts, history overviews, and professional skills training all work exceptionally well with AI-generated video.","answer_vi":"Học ngôn ngữ, hướng dẫn toán, khái niệm khoa học, tổng quan lịch sử và đào tạo kỹ năng chuyên nghiệp đều rất phù hợp với video AI."},{"question_en":"How long should an AI lesson video be?","question_vi":"Video bài giảng AI nên dài bao lâu?","answer_en":"Research shows 5-15 minutes is optimal for engagement. AI makes it easy to break long topics into digestible micro-lessons.","answer_vi":"Nghiên cứu cho thấy 5-15 phút là tối ưu cho sự tập trung. AI giúp dễ dàng chia chủ đề dài thành các bài học nhỏ dễ tiếp thu."}]',
  'AI Video Lessons for Education | Create Course Videos',
  'Bài Giảng Video AI Cho Giáo Dục | Tạo Video Khóa Học',
  'Create AI-generated educational videos and course lessons. Convert slides to narrated presentations — multi-language support for global students.',
  'Tạo video giáo dục và bài giảng khóa học bằng AI. Chuyển đổi slide thành bài thuyết trình có tường thuật — hỗ trợ đa ngôn ngữ cho học viên toàn cầu.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'restaurant',
  'Restaurant / Nhà Hàng',
  'AI Videos for Restaurants & Food Business',
  'Video AI Cho Nhà Hàng & Kinh Doanh Ẩm Thực',
  'Make mouths water with AI-generated food videos that drive reservations and orders.',
  'Khiến thực khách thèm thuồng với video ẩm thực AI tăng đặt bàn và đơn hàng.',
  '[{"icon":"utensils","title_en":"Menu Showcase","title_vi":"Giới Thiệu Thực Đơn","desc_en":"Turn your menu photos into mouth-watering video presentations.","desc_vi":"Biến ảnh thực đơn thành video giới thiệu hấp dẫn."},{"icon":"chef-hat","title_en":"Chef Stories","title_vi":"Câu Chuyện Đầu Bếp","desc_en":"Share your kitchen story and signature dishes with AI-narrated videos.","desc_vi":"Chia sẻ câu chuyện bếp núc và món đặc trưng với video tường thuật AI."},{"icon":"truck","title_en":"Promo Campaigns","title_vi":"Chiến Dịch Khuyến Mãi","desc_en":"Create weekly special, happy hour, and event promo videos in seconds.","desc_vi":"Tạo video khuyến mãi món đặc biệt, happy hour và sự kiện trong vài giây."},{"icon":"star","title_en":"Customer Reviews","title_vi":"Đánh Giá Khách Hàng","desc_en":"Turn written reviews into compelling testimonial videos.","desc_vi":"Biến đánh giá bằng văn bản thành video đánh giá khách hàng thuyết phục."}]',
  '[{"question_en":"Do food videos really increase restaurant sales?","question_vi":"Video ẩm thực có thực sự tăng doanh thu nhà hàng?","answer_en":"Yes — restaurants using video in their marketing see an average 40% increase in online orders. People eat with their eyes first.","answer_vi":"Có — nhà hàng sử dụng video trong tiếp thị thấy đơn hàng trực tuyến tăng trung bình 40%. Khách hàng ăn bằng mắt trước."},{"question_en":"I am not tech-savvy — can I still create videos?","question_vi":"Tôi không rành công nghệ — tôi vẫn có thể tạo video chứ?","answer_en":"Absolutely. You type your menu items or specials, and Sophia creates the video automatically. Designed for non-technical restaurant owners.","answer_vi":"Chắc chắn rồi. Bạn nhập món ăn hoặc khuyến mãi, Sophia tự động tạo video. Thiết kế dành cho chủ nhà hàng không chuyên công nghệ."},{"question_en":"What platforms should I post restaurant videos on?","question_vi":"Tôi nên đăng video nhà hàng trên nền tảng nào?","answer_en":"TikTok, Facebook, Instagram, and YouTube Shorts are best for food content. Also embed videos on your Google Business Profile and website.","answer_vi":"TikTok, Facebook, Instagram và YouTube Shorts là tốt nhất cho nội dung ẩm thực. Cũng nên nhúng video vào Google Business Profile và website."}]',
  'AI Restaurant Videos | Menu Showcase & Food Marketing',
  'Video Nhà Hàng AI | Giới Thiệu Thực Đơn & Tiếp Thị Ẩm Thực',
  'Create AI-generated food and restaurant videos. Showcase your menu, promote specials, and drive orders — designed for non-technical restaurant owners.',
  'Tạo video ẩm thực và nhà hàng bằng AI. Giới thiệu thực đơn, quảng bá khuyến mãi và tăng đơn hàng — thiết kế cho chủ nhà hàng không chuyên công nghệ.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'fitness',
  'Fitness / Thể Hình',
  'AI Fitness & Workout Videos',
  'Video Fitness & Tập Luyện AI',
  'Build your fitness brand with AI-generated workout videos, tips, and motivation.',
  'Xây dựng thương hiệu fitness với video tập luyện, mẹo và động lực bằng AI.',
  '[{"icon":"play-circle","title_en":"Workout Guides","title_vi":"Hướng Dẫn Tập","desc_en":"Create follow-along workout videos with AI voiceover and visual cues.","desc_vi":"Tạo video tập luyện có hướng dẫn với giọng đọc AI và tín hiệu trực quan."},{"icon":"target","title_en":"Transformation Stories","title_vi":"Câu Chuyện Thay Đổi","desc_en":"Share client success stories as motivational video content.","desc_vi":"Chia sẻ câu chuyện thành công của khách hàng dưới dạng video truyền động lực."},{"icon":"calendar","title_en":"Program Overviews","title_vi":"Tổng Quan Chương Trình","desc_en":"Explain your training programs and membership options clearly.","desc_vi":"Giải thích chương trình tập luyện và gói hội viên rõ ràng."},{"icon":"zap","title_en":"Daily Tips","title_vi":"Mẹo Hàng Ngày","desc_en":"Post quick fitness tips and form guides to keep your audience engaged.","desc_vi":"Đăng mẹo fitness nhanh và hướng dẫn tư thế để giữ khán giả tương tác."}]',
  '[{"question_en":"Can AI create actual workout videos without filming?","question_vi":"AI có thể tạo video tập luyện thực tế mà không cần quay phim không?","answer_en":"AI generates explainer-style videos — perfect for exercise demonstrations using animation, form guides with visual overlays, and program overviews. For live-action workouts, you would combine AI narration with your own footage.","answer_vi":"AI tạo video kiểu giải thích — hoàn hảo cho mô phỏng bài tập bằng hoạt hình, hướng dẫn tư thế với lớp phủ trực quan và tổng quan chương trình. Đối với video tập thực tế, bạn kết hợp tường thuật AI với cảnh quay của riêng mình."},{"question_en":"How can I monetize fitness AI videos?","question_vi":"Tôi có thể kiếm tiền từ video fitness AI như thế nào?","answer_en":"Build a YouTube channel with workout content, create paid course libraries, offer personal training upsells through video funnels, or grow your social following for sponsorship deals.","answer_vi":"Xây dựng kênh YouTube với nội dung tập luyện, tạo thư viện khóa học trả phí, cung cấp upsell huấn luyện cá nhân qua phễu video, hoặc phát triển người theo dõi trên mạng xã hội để có hợp đồng tài trợ."},{"question_en":"What is the best video length for fitness content?","question_vi":"Độ dài video tốt nhất cho nội dung fitness là bao nhiêu?","answer_en":"Quick tips: 30-60 seconds. Exercise demos: 1-2 minutes. Full workouts: 10-30 minutes. AI lets you create all three formats efficiently.","answer_vi":"Mẹo nhanh: 30-60 giây. Demo bài tập: 1-2 phút. Buổi tập đầy đủ: 10-30 phút. AI cho phép bạn tạo cả ba định dạng hiệu quả."}]',
  'AI Fitness Videos | Workout Guides & Training Content',
  'Video Fitness AI | Hướng Dẫn Tập Luyện & Nội Dung Đào Tạo',
  'Create AI-generated fitness and workout videos. Build your fitness brand with exercise guides, transformation stories, and daily tips — no filming needed.',
  'Tạo video fitness và tập luyện bằng AI. Xây dựng thương hiệu fitness với hướng dẫn bài tập, câu chuyện thay đổi và mẹo hàng ngày — không cần quay phim.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'lawyer',
  'Lawyer / Luật Sư',
  'AI Videos for Law Firms & Legal Professionals',
  'Video AI Cho Văn Phòng Luật & Chuyên Gia Pháp Lý',
  'Build trust and attract clients with professional AI-generated legal explainer videos.',
  'Xây dựng niềm tin và thu hút khách hàng với video giải thích pháp lý chuyên nghiệp bằng AI.',
  '[{"icon":"scale","title_en":"Legal Explainers","title_vi":"Giải Thích Pháp Lý","desc_en":"Explain complex legal concepts in simple animated video format.","desc_vi":"Giải thích khái niệm pháp lý phức tạp dưới dạng video hoạt hình đơn giản."},{"icon":"briefcase","title_en":"Firm Introduction","title_vi":"Giới Thiệu Văn Phòng","desc_en":"Create a professional welcome video that builds immediate trust.","desc_vi":"Tạo video chào mừng chuyên nghiệp xây dựng niềm tin ngay lập tức."},{"icon":"file-text","title_en":"Practice Area Videos","title_vi":"Video Lĩnh Vực Hành Nghề","desc_en":"Showcase each practice area with dedicated explainer content.","desc_vi":"Giới thiệu từng lĩnh vực hành nghề với nội dung giải thích riêng."},{"icon":"users","title_en":"Client Testimonials","title_vi":"Đánh Giá Khách Hàng","desc_en":"Turn written reviews into professional video testimonials.","desc_vi":"Biến đánh giá bằng văn bản thành video đánh giá khách hàng chuyên nghiệp."}]',
  '[{"question_en":"Is AI video content professional enough for law firms?","question_vi":"Nội dung video AI có đủ chuyên nghiệp cho văn phòng luật không?","answer_en":"Yes — many leading law firms now use video marketing. AI-generated explainer videos maintain a polished, professional tone while making legal topics accessible to potential clients.","answer_vi":"Có — nhiều văn phòng luật hàng đầu hiện sử dụng tiếp thị video. Video giải thích AI duy trì giọng điệu chuyên nghiệp, lịch sự trong khi làm chủ đề pháp lý dễ tiếp cận với khách hàng tiềm năng."},{"question_en":"What legal topics work best for video content?","question_vi":"Những chủ đề pháp lý nào phù hợp nhất cho nội dung video?","answer_en":"Personal injury FAQs, estate planning overviews, business formation guides, divorce process walkthroughs, and DUI defense explanations all perform well as educational video content.","answer_vi":"Câu hỏi thường gặp về thương tích cá nhân, tổng quan lập kế hoạch di sản, hướng dẫn thành lập doanh nghiệp, quy trình ly hôn và giải thích biện hộ DUI đều hoạt động tốt dưới dạng nội dung video giáo dục."},{"question_en":"Do I need to worry about bar association rules?","question_vi":"Tôi có cần lo lắng về quy tắc của đoàn luật sư không?","answer_en":"Always review AI-generated legal content before publishing. Most bar associations allow educational marketing content as long as it is accurate and not misleading. Add a disclaimer that videos are informational, not legal advice.","answer_vi":"Luôn xem xét nội dung pháp lý do AI tạo trước khi đăng. Hầu hết đoàn luật sư cho phép nội dung tiếp thị giáo dục miễn là chính xác và không gây hiểu lầm. Thêm tuyên bố miễn trừ rằng video chỉ mang tính thông tin, không phải tư vấn pháp lý."}]',
  'AI Videos for Law Firms | Legal Marketing Content',
  'Video AI Cho Văn Phòng Luật | Nội Dung Tiếp Thị Pháp Lý',
  'Create professional AI-generated videos for your law firm. Legal explainers, practice area showcases, and client testimonials — build trust and attract clients.',
  'Tạo video chuyên nghiệp bằng AI cho văn phòng luật của bạn. Giải thích pháp lý, giới thiệu lĩnh vực hành nghề và đánh giá khách hàng — xây dựng niềm tin và thu hút khách hàng.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'insurance',
  'Insurance / Bảo Hiểm',
  'AI Videos for Insurance Agents & Brokers',
  'Video AI Cho Đại Lý & Môi Giới Bảo Hiểm',
  'Simplify policies, explain coverage, and generate leads with AI video content.',
  'Đơn giản hóa chính sách, giải thích bảo hiểm và tạo khách hàng tiềm năng với nội dung video AI.',
  '[{"icon":"umbrella","title_en":"Policy Explainers","title_vi":"Giải Thích Chính Sách","desc_en":"Make complex insurance policies easy to understand with animated videos.","desc_vi":"Làm cho chính sách bảo hiểm phức tạp dễ hiểu với video hoạt hình."},{"icon":"phone-call","title_en":"Lead Generation","title_vi":"Tạo Khách Hàng","desc_en":"Create video ads that drive quote requests and consultation bookings.","desc_vi":"Tạo quảng cáo video thúc đẩy yêu cầu báo giá và đặt lịch tư vấn."},{"icon":"shield-check","title_en":"Coverage Comparisons","title_vi":"So Sánh Bảo Hiểm","desc_en":"Show side-by-side plan comparisons in clear video format.","desc_vi":"Hiển thị so sánh các gói bảo hiểm dưới dạng video rõ ràng."},{"icon":"smile","title_en":"Claims Guidance","title_vi":"Hướng Dẫn Yêu Cầu Bồi Thường","desc_en":"Walk clients through the claims process with step-by-step video guides.","desc_vi":"Hướng dẫn khách hàng qua quy trình yêu cầu bồi thường với video từng bước."}]',
  '[{"question_en":"Can AI videos help sell insurance policies?","question_vi":"Video AI có thể giúp bán bảo hiểm không?","answer_en":"Yes — educational video content builds trust before the sales conversation. Agents using video see 40-60% higher lead-to-quote conversion rates compared to text-only marketing.","answer_vi":"Có — nội dung video giáo dục xây dựng niềm tin trước cuộc trò chuyện bán hàng. Đại lý sử dụng video thấy tỷ lệ chuyển đổi từ khách hàng tiềm năng sang báo giá cao hơn 40-60% so với tiếp thị chỉ bằng văn bản."},{"question_en":"What types of insurance benefit most from video marketing?","question_vi":"Loại bảo hiểm nào hưởng lợi nhiều nhất từ tiếp thị video?","answer_en":"Life insurance (emotional stories), health insurance (plan comparisons), auto insurance (quick quote promos), and business insurance (risk explainers) all perform well with video.","answer_vi":"Bảo hiểm nhân thọ (câu chuyện cảm xúc), bảo hiểm sức khỏe (so sánh gói), bảo hiểm ô tô (khuyến mãi báo giá nhanh) và bảo hiểm doanh nghiệp (giải thích rủi ro) đều hoạt động tốt với video."},{"question_en":"How often should I post insurance videos?","question_vi":"Tôi nên đăng video bảo hiểm bao lâu một lần?","answer_en":"2-3 videos per week is ideal for social media. A library of 15-20 evergreen explainer videos on your website provides ongoing lead generation value.","answer_vi":"2-3 video mỗi tuần là lý tưởng cho mạng xã hội. Thư viện 15-20 video giải thích thường xanh trên website cung cấp giá trị tạo khách hàng liên tục."}]',
  'AI Videos for Insurance Agents | Policy Explainer Videos',
  'Video AI Cho Đại Lý Bảo Hiểm | Video Giải Thích Chính Sách',
  'Create AI-generated insurance explainer videos. Simplify complex policies, generate more leads, and build client trust — no video production experience needed.',
  'Tạo video giải thích bảo hiểm bằng AI. Đơn giản hóa chính sách phức tạp, tạo nhiều khách hàng tiềm năng hơn và xây dựng niềm tin — không cần kinh nghiệm sản xuất video.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'travel',
  'Travel / Du Lịch',
  'AI Travel & Tourism Videos',
  'Video Du Lịch AI',
  'Inspire wanderlust with AI-generated travel guides, destination highlights, and tour promos.',
  'Truyền cảm hứng du lịch với video hướng dẫn, điểm đến nổi bật và quảng bá tour bằng AI.',
  '[{"icon":"map","title_en":"Destination Guides","title_vi":"Hướng Dẫn Điểm Đến","desc_en":"Create stunning destination overview videos that inspire bookings.","desc_vi":"Tạo video tổng quan điểm đến ấn tượng thúc đẩy đặt chỗ."},{"icon":"compass","title_en":"Itinerary Previews","title_vi":"Xem Trước Hành Trình","desc_en":"Showcase tour packages and travel itineraries in engaging video format.","desc_vi":"Giới thiệu gói tour và hành trình du lịch dưới dạng video hấp dẫn."},{"icon":"camera","title_en":"Travel Tips","title_vi":"Mẹo Du Lịch","desc_en":"Share packing guides, budget tips, and local insights as video content.","desc_vi":"Chia sẻ hướng dẫn đóng gói, mẹo tiết kiệm và kiến thức địa phương dưới dạng nội dung video."},{"icon":"globe","title_en":"Cultural Content","title_vi":"Nội Dung Văn Hóa","desc_en":"Highlight local culture, cuisine, and traditions through AI-narrated stories.","desc_vi":"Làm nổi bật văn hóa, ẩm thực và truyền thống địa phương qua câu chuyện tường thuật AI."}]',
  '[{"question_en":"Can AI create realistic travel videos without actual footage?","question_vi":"AI có thể tạo video du lịch thực tế mà không cần cảnh quay thật không?","answer_en":"AI can create engaging promotional and informational travel content using stock footage-style visuals, animations, and AI narration. For best results, combine AI-generated content with your own destination photos and clips.","answer_vi":"AI có thể tạo nội dung du lịch quảng bá và thông tin hấp dẫn sử dụng hình ảnh kiểu stock footage, hoạt hình và tường thuật AI. Để kết quả tốt nhất, kết hợp nội dung AI với ảnh và clip điểm đến của riêng bạn."},{"question_en":"What travel video content performs best on social media?","question_vi":"Nội dung video du lịch nào hoạt động tốt nhất trên mạng xã hội?","answer_en":"Top 10 lists, hidden gem reveals, budget breakdowns, and quick destination overviews under 60 seconds consistently get the highest engagement.","answer_vi":"Danh sách top 10, tiết lộ địa điểm ẩn, phân tích ngân sách và tổng quan điểm đến nhanh dưới 60 giây luôn có tương tác cao nhất."},{"question_en":"How can travel agencies use AI video marketing?","question_vi":"Đại lý du lịch có thể sử dụng tiếp thị video AI như thế nào?","answer_en":"Create destination showcases, tour package previews, seasonal promotion videos, and customer testimonial compilations — all without hiring a video production team.","answer_vi":"Tạo giới thiệu điểm đến, xem trước gói tour, video khuyến mãi theo mùa và tổng hợp đánh giá khách hàng — tất cả không cần thuê đội sản xuất video."}]',
  'AI Travel Videos | Destination Guides & Tourism Marketing',
  'Video Du Lịch AI | Hướng Dẫn Điểm Đến & Tiếp Thị Du Lịch',
  'Create AI-generated travel and tourism videos. Destination guides, itinerary previews, and travel tips — inspire bookings with professional video content.',
  'Tạo video du lịch bằng AI. Hướng dẫn điểm đến, xem trước hành trình và mẹo du lịch — truyền cảm hứng đặt chỗ với nội dung video chuyên nghiệp.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'automotive',
  'Automotive / Ô Tô',
  'AI Car Dealership & Automotive Videos',
  'Video AI Cho Đại Lý Ô Tô & Xe Cộ',
  'Showcase vehicles, explain features, and drive showroom visits with AI video.',
  'Giới thiệu xe, giải thích tính năng và thúc đẩy khách đến showroom với video AI.',
  '[{"icon":"car","title_en":"Vehicle Walkarounds","title_vi":"Giới Thiệu Xe","desc_en":"Create virtual vehicle tours highlighting key features and specs.","desc_vi":"Tạo video tham quan xe ảo làm nổi bật tính năng và thông số chính."},{"icon":"wrench","title_en":"Service Promos","title_vi":"Khuyến Mãi Dịch Vụ","desc_en":"Promote maintenance packages and seasonal service specials.","desc_vi":"Quảng bá gói bảo dưỡng và khuyến mãi dịch vụ theo mùa."},{"icon":"compare","title_en":"Model Comparisons","title_vi":"So Sánh Mẫu Xe","desc_en":"Help buyers compare models with side-by-side video presentations.","desc_vi":"Giúp người mua so sánh các mẫu xe với video trình bày cạnh nhau."},{"icon":"thumbs-up","title_en":"Customer Delivery","title_vi":"Bàn Giao Xe","desc_en":"Create memorable new car delivery celebration videos for clients.","desc_vi":"Tạo video kỷ niệm bàn giao xe mới đáng nhớ cho khách hàng."}]',
  '[{"question_en":"Will AI car videos help me sell more vehicles?","question_vi":"Video ô tô AI có giúp tôi bán được nhiều xe hơn không?","answer_en":"Yes — car listings with video get 5x more inquiries than photo-only listings. AI makes it affordable to create videos for every vehicle in your inventory, not just the premium ones.","answer_vi":"Có — tin đăng xe có video nhận được nhiều hơn gấp 5 lần lượt hỏi thăm so với tin chỉ có ảnh. AI giúp tạo video giá rẻ cho mọi xe trong kho, không chỉ xe cao cấp."},{"question_en":"How detailed can AI car videos be?","question_vi":"Video ô tô AI có thể chi tiết đến mức nào?","answer_en":"AI videos can cover exterior design, interior features, safety tech, engine specs, pricing, and financing options — all in a structured walkaround format. Upload your vehicle details and Sophia builds the script.","answer_vi":"Video AI có thể bao gồm thiết kế ngoại thất, tính năng nội thất, công nghệ an toàn, thông số động cơ, giá cả và tùy chọn tài chính — tất cả theo định dạng giới thiệu có cấu trúc. Tải lên thông tin xe và Sophia xây dựng kịch bản."},{"question_en":"Can I create videos for used cars too?","question_vi":"Tôi có thể tạo video cho xe đã qua sử dụng không?","answer_en":"Absolutely. AI videos are especially valuable for used cars where every vehicle is unique — creating individual videos for each unit was previously too expensive and time-consuming.","answer_vi":"Chắc chắn. Video AI đặc biệt có giá trị cho xe đã qua sử dụng nơi mỗi xe là duy nhất — tạo video riêng cho từng chiếc trước đây quá đắt đỏ và tốn thời gian."}]',
  'AI Car Dealership Videos | Vehicle Walkarounds & Auto Marketing',
  'Video Đại Lý Ô Tô AI | Giới Thiệu Xe & Tiếp Thị Ô Tô',
  'Create AI-generated car dealership and automotive videos. Virtual vehicle tours, model comparisons, and service promos — sell more cars with professional video content.',
  'Tạo video đại lý ô tô bằng AI. Tham quan xe ảo, so sánh mẫu xe và khuyến mãi dịch vụ — bán nhiều xe hơn với nội dung video chuyên nghiệp.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'fashion',
  'Fashion / Thời Trang',
  'AI Fashion & Style Videos',
  'Video Thời Trang & Phong Cách AI',
  'Create runway-style fashion showcases, lookbooks, and styling tips with AI videos.',
  'Tạo video trình diễn thời trang, lookbook và mẹo phối đồ với video AI.',
  '[{"icon":"shirt","title_en":"Lookbook Videos","title_vi":"Video Lookbook","desc_en":"Turn your collection photos into stunning fashion lookbook presentations.","desc_vi":"Biến ảnh bộ sưu tập thành video lookbook thời trang ấn tượng."},{"icon":"sparkles","title_en":"Styling Tips","title_vi":"Mẹo Phối Đồ","desc_en":"Share outfit ideas and styling advice through AI-narrated video guides.","desc_vi":"Chia sẻ ý tưởng trang phục và lời khuyên phối đồ qua video hướng dẫn tường thuật AI."},{"icon":"shopping-bag","title_en":"New Arrivals","title_vi":"Hàng Mới Về","desc_en":"Announce new collections and drops with eye-catching video promos.","desc_vi":"Thông báo bộ sưu tập mới và hàng về với video quảng cáo bắt mắt."},{"icon":"trending-up","title_en":"Trend Reports","title_vi":"Báo Cáo Xu Hướng","desc_en":"Create seasonal trend forecast videos to position yourself as a style authority.","desc_vi":"Tạo video dự báo xu hướng theo mùa để định vị bạn là chuyên gia phong cách."}]',
  '[{"question_en":"Can AI videos replace fashion photography?","question_vi":"Video AI có thể thay thế chụp ảnh thời trang không?","answer_en":"AI videos complement fashion photography by adding motion, transitions, and narration. They are especially effective for social media where video content gets 3-5x more engagement than static images.","answer_vi":"Video AI bổ sung cho chụp ảnh thời trang bằng cách thêm chuyển động, chuyển cảnh và tường thuật. Chúng đặc biệt hiệu quả trên mạng xã hội nơi nội dung video có tương tác cao gấp 3-5 lần ảnh tĩnh."},{"question_en":"What fashion content works best as AI video?","question_vi":"Nội dung thời trang nào hoạt động tốt nhất dưới dạng video AI?","answer_en":"Haul videos, styling challenges, outfit-of-the-day series, trend reports, and new collection reveals are all highly effective as AI-generated content on TikTok, Instagram, and YouTube.","answer_vi":"Video haul, thử thách phối đồ, series trang phục trong ngày, báo cáo xu hướng và ra mắt bộ sưu tập mới đều rất hiệu quả dưới dạng nội dung AI trên TikTok, Instagram và YouTube."},{"question_en":"How often should fashion brands post videos?","question_vi":"Thương hiệu thời trang nên đăng video bao lâu một lần?","answer_en":"Top fashion brands post daily on TikTok/Reels and 3-5 times per week on YouTube. AI makes this posting frequency achievable without a full-time video team.","answer_vi":"Thương hiệu thời trang hàng đầu đăng hàng ngày trên TikTok/Reels và 3-5 lần mỗi tuần trên YouTube. AI giúp tần suất đăng này khả thi mà không cần đội video toàn thời gian."}]',
  'AI Fashion Videos | Lookbook, Style Tips & Fashion Marketing',
  'Video Thời Trang AI | Lookbook, Mẹo Phối Đồ & Tiếp Thị Thời Trang',
  'Create AI-generated fashion and style videos. Lookbook presentations, styling tips, and new arrival announcements — elevate your fashion brand with professional video content.',
  'Tạo video thời trang và phong cách bằng AI. Trình diễn lookbook, mẹo phối đồ và thông báo hàng mới — nâng tầm thương hiệu thời trang với nội dung video chuyên nghiệp.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'gaming',
  'Gaming / Trò Chơi',
  'AI Gaming & Esports Videos',
  'Video Game & Esports AI',
  'Create gameplay highlights, game reviews, and streaming content with AI-powered videos.',
  'Tạo video highlight game, đánh giá game và nội dung stream với video AI.',
  '[{"icon":"gamepad","title_en":"Game Reviews","title_vi":"Đánh Giá Game","desc_en":"Create professional game review videos with AI narration and visuals.","desc_vi":"Tạo video đánh giá game chuyên nghiệp với tường thuật và hình ảnh AI."},{"icon":"swords","title_en":"Highlights & Montages","title_vi":"Highlight & Montage","desc_en":"Turn your best gameplay moments into cinematic highlight reels.","desc_vi":"Biến khoảnh khắc chơi game hay nhất thành video highlight điện ảnh."},{"icon":"twitch","title_en":"Stream Recaps","title_vi":"Tổng Hợp Stream","desc_en":"Create weekly stream recap videos to grow your YouTube channel.","desc_vi":"Tạo video tổng hợp stream hàng tuần để phát triển kênh YouTube."},{"icon":"trophy","title_en":"Esports Coverage","title_vi":"Tin Tức Esports","desc_en":"Cover tournaments, roster changes, and esports news with AI videos.","desc_vi":"Đưa tin giải đấu, thay đổi đội hình và tin tức esports với video AI."}]',
  '[{"question_en":"Can AI create gaming videos without gameplay footage?","question_vi":"AI có thể tạo video game mà không cần cảnh quay game không?","answer_en":"AI is best for narrated content like reviews, news, and analysis. For gameplay showcases, combine AI voiceover with your recorded clips for a polished, professional result.","answer_vi":"AI tốt nhất cho nội dung có tường thuật như đánh giá, tin tức và phân tích. Đối với video gameplay, kết hợp giọng đọc AI với clip ghi hình của bạn để có kết quả chuyên nghiệp."},{"question_en":"What gaming content can I monetize?","question_vi":"Nội dung game nào tôi có thể kiếm tiền?","answer_en":"Game reviews, tutorial videos, news updates, top-10 lists, and esports analysis all attract gaming audiences and are eligible for YouTube monetization and sponsorship deals.","answer_vi":"Đánh giá game, video hướng dẫn, cập nhật tin tức, danh sách top-10 và phân tích esports đều thu hút khán giả game và đủ điều kiện kiếm tiền trên YouTube và hợp đồng tài trợ."},{"question_en":"How can I stand out in the crowded gaming niche?","question_vi":"Làm sao để nổi bật trong lĩnh vực game đông đúc?","answer_en":"AI lets you produce content faster than competitors. Focus on a specific game or genre, post consistently (daily if possible), and use AI to maintain high production quality without burning out.","answer_vi":"AI cho phép bạn sản xuất nội dung nhanh hơn đối thủ. Tập trung vào một game hoặc thể loại cụ thể, đăng đều đặn (hàng ngày nếu có thể) và sử dụng AI để duy trì chất lượng sản xuất cao mà không kiệt sức."}]',
  'AI Gaming Videos | Game Reviews, Highlights & Esports Content',
  'Video Game AI | Đánh Giá Game, Highlight & Nội Dung Esports',
  'Create AI-generated gaming videos. Game reviews, highlight reels, and esports coverage — grow your gaming channel with professional video content, no editing skills needed.',
  'Tạo video game bằng AI. Đánh giá game, video highlight và tin tức esports — phát triển kênh game với nội dung video chuyên nghiệp, không cần kỹ năng chỉnh sửa.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'music',
  'Music / Âm Nhạc',
  'AI Music & Artist Promotion Videos',
  'Video Quảng Bá Âm Nhạc & Nghệ Sĩ AI',
  'Create music videos, artist promos, and music education content with AI.',
  'Tạo video nhạc, quảng bá nghệ sĩ và nội dung giáo dục âm nhạc với AI.',
  '[{"icon":"music","title_en":"Lyric Videos","title_vi":"Video Lời Nhạc","desc_en":"Create animated lyric videos for your tracks in minutes.","desc_vi":"Tạo video lời nhạc hoạt hình cho bài hát của bạn trong vài phút."},{"icon":"mic","title_en":"Artist Promos","title_vi":"Quảng Bá Nghệ Sĩ","desc_en":"Build your artist brand with professional bio and announcement videos.","desc_vi":"Xây dựng thương hiệu nghệ sĩ với video tiểu sử và thông báo chuyên nghiệp."},{"icon":"disc","title_en":"Album Teasers","title_vi":"Teaser Album","desc_en":"Generate hype for new releases with cinematic teaser trailers.","desc_vi":"Tạo sức nóng cho sản phẩm mới với trailer teaser điện ảnh."},{"icon":"headphones","title_en":"Music Lessons","title_vi":"Bài Học Âm Nhạc","desc_en":"Create instrument tutorials and music theory explainer videos.","desc_vi":"Tạo video hướng dẫn nhạc cụ và giải thích lý thuyết âm nhạc."}]',
  '[{"question_en":"Can AI create actual music videos?","question_vi":"AI có thể tạo video âm nhạc thực sự không?","answer_en":"AI creates animated visual content synced to your music — perfect for lyric videos, visualizers, and promotional content. For live-action music videos, AI handles the editing and effects but you will need your own footage.","answer_vi":"AI tạo nội dung hình ảnh hoạt hình đồng bộ với nhạc của bạn — hoàn hảo cho video lời nhạc, visualizer và nội dung quảng bá. Đối với video âm nhạc người thật, AI xử lý chỉnh sửa và hiệu ứng nhưng bạn cần cảnh quay của riêng mình."},{"question_en":"How can independent artists use AI video marketing?","question_vi":"Nghệ sĩ độc lập có thể sử dụng tiếp thị video AI như thế nào?","answer_en":"Create consistent content for TikTok (30+ videos/month), YouTube lyric videos for every track, behind-the-scenes stories, and fan engagement content — all without the cost of hiring video editors.","answer_vi":"Tạo nội dung nhất quán cho TikTok (30+ video/tháng), video lời nhạc YouTube cho mỗi bài hát, câu chuyện hậu trường và nội dung tương tác với fan — tất cả không tốn chi phí thuê biên tập video."},{"question_en":"What music content performs best on social media?","question_vi":"Nội dung âm nhạc nào hoạt động tốt nhất trên mạng xã hội?","answer_en":"Behind-the-scenes clips, songwriting process breakdowns, cover song teasers, and day-in-the-life artist vlogs consistently get the highest engagement from music fans.","answer_vi":"Clip hậu trường, phân tích quá trình sáng tác, teaser cover và vlog một ngày của nghệ sĩ luôn có tương tác cao nhất từ người hâm mộ âm nhạc."}]',
  'AI Music Videos | Lyric Videos, Artist Promos & Music Marketing',
  'Video Âm Nhạc AI | Video Lời Nhạc, Quảng Bá Nghệ Sĩ & Tiếp Thị Âm Nhạc',
  'Create AI-generated music promotion videos. Lyric videos, artist bios, and album teasers — grow your music career with professional video content, no editing skills needed.',
  'Tạo video quảng bá âm nhạc bằng AI. Video lời nhạc, tiểu sử nghệ sĩ và teaser album — phát triển sự nghiệp âm nhạc với nội dung video chuyên nghiệp, không cần kỹ năng chỉnh sửa.',
  1
);

INSERT OR IGNORE INTO landing_pages (id, niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json, faq_json, meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published)
VALUES (
  'photography',
  'Photography / Nhiếp Ảnh',
  'AI Photography & Portfolio Videos',
  'Video Nhiếp Ảnh & Portfolio AI',
  'Showcase your photography work, share editing tips, and attract clients with AI videos.',
  'Trưng bày tác phẩm nhiếp ảnh, chia sẻ mẹo chỉnh sửa và thu hút khách hàng với video AI.',
  '[{"icon":"camera","title_en":"Portfolio Reels","title_vi":"Reel Portfolio","desc_en":"Turn your photo collections into stunning cinematic portfolio videos.","desc_vi":"Biến bộ sưu tập ảnh thành video portfolio điện ảnh ấn tượng."},{"icon":"edit","title_en":"Editing Tutorials","title_vi":"Hướng Dẫn Chỉnh Sửa","desc_en":"Create Lightroom and Photoshop tutorial videos with AI voiceover.","desc_vi":"Tạo video hướng dẫn Lightroom và Photoshop với giọng đọc AI."},{"icon":"video","title_en":"Behind the Scenes","title_vi":"Hậu Trường","desc_en":"Share your creative process and photoshoot BTS content as engaging videos.","desc_vi":"Chia sẻ quá trình sáng tạo và nội dung hậu trường buổi chụp dưới dạng video hấp dẫn."},{"icon":"bookmark","title_en":"Client Guides","title_vi":"Hướng Dẫn Khách Hàng","desc_en":"Create prep guides and what-to-expect videos for photography clients.","desc_vi":"Tạo video hướng dẫn chuẩn bị và những điều cần biết cho khách hàng chụp ảnh."}]',
  '[{"question_en":"Can AI create photography portfolio videos?","question_vi":"AI có thể tạo video portfolio nhiếp ảnh không?","answer_en":"Yes — AI turns your still photos into dynamic slideshow videos with cinematic transitions, music, and AI narration describing your work and style. Upload your best images and let AI do the rest.","answer_vi":"Có — AI biến ảnh tĩnh của bạn thành video slideshow động với chuyển cảnh điện ảnh, nhạc và tường thuật AI mô tả tác phẩm và phong cách của bạn. Tải lên ảnh đẹp nhất và để AI xử lý phần còn lại."},{"question_en":"How can photographers use video to get more clients?","question_vi":"Nhiếp ảnh gia có thể sử dụng video để có thêm khách hàng như thế nào?","answer_en":"Video portfolios convert better than static galleries. Create niche-specific reels (weddings, portraits, real estate), client education videos, and behind-the-scenes content to showcase your expertise and personality.","answer_vi":"Portfolio video chuyển đổi tốt hơn gallery tĩnh. Tạo reel theo từng lĩnh vực (cưới, chân dung, bất động sản), video giáo dục khách hàng và nội dung hậu trường để thể hiện chuyên môn và cá tính."},{"question_en":"What video content should photographers post regularly?","question_vi":"Nhiếp ảnh gia nên đăng nội dung video gì thường xuyên?","answer_en":"Weekly editing tips, before-and-after edits, gear reviews, client session sneak peeks, and seasonal mini-session promos keep your audience engaged and attract new bookings.","answer_vi":"Mẹo chỉnh sửa hàng tuần, so sánh trước-sau chỉnh sửa, đánh giá thiết bị, hé lộ buổi chụp khách hàng và khuyến mãi mini-session theo mùa giữ khán giả tương tác và thu hút đặt lịch mới."}]',
  'AI Photography Videos | Portfolio Reels & Client Marketing',
  'Video Nhiếp Ảnh AI | Reel Portfolio & Tiếp Thị Khách Hàng',
  'Create AI-generated photography videos. Turn your photo portfolio into cinematic reels, share editing tutorials, and attract more clients — no video editing skills needed.',
  'Tạo video nhiếp ảnh bằng AI. Biến portfolio ảnh thành reel điện ảnh, chia sẻ hướng dẫn chỉnh sửa và thu hút thêm khách hàng — không cần kỹ năng chỉnh sửa video.',
  1
);
