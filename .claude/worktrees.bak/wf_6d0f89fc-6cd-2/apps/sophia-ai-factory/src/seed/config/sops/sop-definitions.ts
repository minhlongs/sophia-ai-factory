/**
 * Official SOP (Standard Operating Procedure) definitions for the Solo SOPs Platform.
 *
 * Each SOP describes a complete revenue-generating workflow with bilingual metadata
 * (English + Vietnamese), step-by-step instructions, tool configuration, and
 * estimated revenue ranges.
 *
 * @module seed/config/sops/sop-definitions
 */

export type SopDefinition = {
  slug: string;
  name_en: string;
  name_vi: string;
  description_en: string;
  description_vi: string;
  category: 'content' | 'business' | 'marketing' | 'operations';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_revenue_min: number;
  estimated_revenue_max: number;
  setup_time_minutes: number;
  credits_per_run: number;
  steps: SopStepDef[];
};

export type SopStepDef = {
  order: number;
  name_en: string;
  name_vi: string;
  description_en: string;
  description_vi: string;
  tool: string;
  tool_config: Record<string, unknown>;
  estimated_minutes: number;
  is_automated: boolean;
};

// ── SOP 1: Faceless YouTube Cash Cow ────────────────────────────────────────

const facelessYoutubeCashCow: SopDefinition = {
  slug: 'faceless-youtube-cash-cow',
  name_en: 'Faceless YouTube Cash Cow',
  name_vi: 'Kênh YouTube Mặt Ẩn Thu Nhập Thụ Động',
  description_en:
    'Build and monetize a faceless YouTube channel using AI-generated scripts, voiceovers, and visuals. Target evergreen niches for long-term passive income via AdSense and sponsorships.',
  description_vi:
    'Xây dựng và kiếm tiền từ kênh YouTube không lộ mặt bằng AI tạo kịch bản, giọng đọc và hình ảnh. Nhắm vào các ngách evergreen để thu nhập thụ động lâu dài qua AdSense và tài trợ.',
  category: 'content',
  difficulty: 'beginner',
  estimated_revenue_min: 2000,
  estimated_revenue_max: 10000,
  setup_time_minutes: 120,
  credits_per_run: 15,
  steps: [
    {
      order: 1,
      name_en: 'Research Niche',
      name_vi: 'Nghiên Cứu Ngách',
      description_en:
        'Identify a profitable evergreen niche with high CPM and low competition using keyword research tools.',
      description_vi:
        'Xác định ngách evergreen có lợi nhuận cao, CPM tốt và cạnh tranh thấp bằng công cụ nghiên cứu từ khóa.',
      tool: 'keyword-research',
      tool_config: { source: 'youtube', filters: { min_volume: 1000, max_competition: 0.5 } },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 2,
      name_en: 'Write Script (AI)',
      name_vi: 'Viết Kịch Bản (AI)',
      description_en:
        'Generate a structured video script using AI based on the chosen topic and target audience.',
      description_vi:
        'Tạo kịch bản video có cấu trúc bằng AI dựa trên chủ đề đã chọn và đối tượng mục tiêu.',
      tool: 'ai-script-writer',
      tool_config: { model: 'openrouter', style: 'educational', target_length_words: 1200 },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 3,
      name_en: 'Generate Voiceover (TTS)',
      name_vi: 'Tạo Giọng Đọc (TTS)',
      description_en:
        'Convert the script to a natural-sounding voiceover using text-to-speech AI.',
      description_vi:
        'Chuyển kịch bản thành giọng đọc tự nhiên bằng AI text-to-speech.',
      tool: 'elevenlabs-tts',
      tool_config: { voice: 'adam', stability: 0.75, similarity_boost: 0.75 },
      estimated_minutes: 10,
      is_automated: true,
    },
    {
      order: 4,
      name_en: 'Create Visuals (AI Video)',
      name_vi: 'Tạo Hình Ảnh (AI Video)',
      description_en:
        'Generate B-roll footage, stock clips, and AI visuals to match each script segment.',
      description_vi:
        'Tạo cảnh B-roll, clip stock và hình ảnh AI phù hợp với từng đoạn kịch bản.',
      tool: 'ai-video-generator',
      tool_config: { provider: 'd-id', resolution: '1080p', style: 'cinematic' },
      estimated_minutes: 20,
      is_automated: true,
    },
    {
      order: 5,
      name_en: 'Edit / Compose Video',
      name_vi: 'Chỉnh Sửa / Ghép Video',
      description_en:
        'Combine voiceover, visuals, background music, and captions into the final video.',
      description_vi:
        'Kết hợp giọng đọc, hình ảnh, nhạc nền và phụ đề thành video hoàn chỉnh.',
      tool: 'video-editor',
      tool_config: { format: 'mp4', resolution: '1920x1080', add_captions: true },
      estimated_minutes: 25,
      is_automated: false,
    },
    {
      order: 6,
      name_en: 'Create Thumbnail',
      name_vi: 'Tạo Thumbnail',
      description_en:
        'Design a click-worthy thumbnail using AI image generation and template overlays.',
      description_vi:
        'Thiết kế thumbnail thu hút click bằng AI tạo ảnh và overlay template.',
      tool: 'ai-image-generator',
      tool_config: { size: '1280x720', style: 'youtube-thumbnail', add_text: true },
      estimated_minutes: 10,
      is_automated: true,
    },
    {
      order: 7,
      name_en: 'Upload to YouTube',
      name_vi: 'Tải Lên YouTube',
      description_en:
        'Upload the finished video to YouTube with title, description, and tags.',
      description_vi:
        'Tải video hoàn chỉnh lên YouTube với tiêu đề, mô tả và thẻ tag.',
      tool: 'youtube-api',
      tool_config: { privacy: 'public', category: 'Education' },
      estimated_minutes: 10,
      is_automated: true,
    },
    {
      order: 8,
      name_en: 'Optimize SEO',
      name_vi: 'Tối Ưu SEO',
      description_en:
        'Optimize video title, description, tags, and chapters for maximum search visibility.',
      description_vi:
        'Tối ưu tiêu đề, mô tả, tag và chương video để tăng khả năng tìm kiếm.',
      tool: 'youtube-seo',
      tool_config: { target_keyword_count: 5, add_chapters: true, add_hashtags: true },
      estimated_minutes: 15,
      is_automated: false,
    },
  ],
};

// ── SOP 2: TikTok Creativity Program ────────────────────────────────────────

const tiktokCreativityProgram: SopDefinition = {
  slug: 'tiktok-creativity-program',
  name_en: 'TikTok Creativity Program',
  name_vi: 'Chương Trình Sáng Tạo TikTok',
  description_en:
    'Monetize TikTok through the Creativity Program by publishing AI-generated short-form videos consistently. Focus on trending topics and viral hooks to maximize views and revenue.',
  description_vi:
    'Kiếm tiền từ TikTok qua Chương Trình Sáng Tạo bằng cách đăng video ngắn do AI tạo ra thường xuyên. Tập trung vào chủ đề hot và hook viral để tối đa lượt xem và doanh thu.',
  category: 'content',
  difficulty: 'beginner',
  estimated_revenue_min: 1000,
  estimated_revenue_max: 5000,
  setup_time_minutes: 60,
  credits_per_run: 10,
  steps: [
    {
      order: 1,
      name_en: 'Research Trending Topics',
      name_vi: 'Nghiên Cứu Chủ Đề Trending',
      description_en:
        'Identify trending sounds, hashtags, and topics on TikTok for maximum algorithmic reach.',
      description_vi:
        'Xác định âm thanh, hashtag và chủ đề đang trending trên TikTok để đạt reach thuật toán tối đa.',
      tool: 'tiktok-trends',
      tool_config: { region: 'global', time_window: '24h', min_video_count: 10000 },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 2,
      name_en: 'Write Short Script',
      name_vi: 'Viết Kịch Bản Ngắn',
      description_en:
        'Create a 30–60 second script with a strong hook in the first 3 seconds.',
      description_vi:
        'Tạo kịch bản 30–60 giây với hook mạnh trong 3 giây đầu tiên.',
      tool: 'ai-script-writer',
      tool_config: { model: 'openrouter', style: 'tiktok-hook', max_words: 200 },
      estimated_minutes: 10,
      is_automated: true,
    },
    {
      order: 3,
      name_en: 'Generate AI Avatar Video',
      name_vi: 'Tạo Video AI Avatar',
      description_en:
        'Produce a talking-head AI avatar video from the script for a faceless presenter look.',
      description_vi:
        'Tạo video AI avatar nói chuyện từ kịch bản cho hình ảnh người dẫn chương trình không lộ mặt.',
      tool: 'ai-avatar-generator',
      tool_config: { provider: 'd-id', avatar: 'auto', language: 'en', aspect_ratio: '9:16' },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 4,
      name_en: 'Add Captions / Effects',
      name_vi: 'Thêm Phụ Đề / Hiệu Ứng',
      description_en:
        'Add animated captions, sound effects, and trending overlays to boost engagement.',
      description_vi:
        'Thêm phụ đề động, hiệu ứng âm thanh và overlay trending để tăng tương tác.',
      tool: 'video-editor',
      tool_config: { caption_style: 'tiktok', add_trending_sound: true, format: 'mp4' },
      estimated_minutes: 10,
      is_automated: false,
    },
    {
      order: 5,
      name_en: 'Upload to TikTok',
      name_vi: 'Tải Lên TikTok',
      description_en:
        'Publish the video to TikTok with optimized caption, hashtags, and scheduling.',
      description_vi:
        'Đăng video lên TikTok với caption, hashtag tối ưu và lịch đăng bài.',
      tool: 'tiktok-api',
      tool_config: { privacy: 'public', schedule: 'peak_hours' },
      estimated_minutes: 5,
      is_automated: true,
    },
    {
      order: 6,
      name_en: 'Track Analytics',
      name_vi: 'Theo Dõi Phân Tích',
      description_en:
        'Monitor views, watch time, and follower growth to optimize future content.',
      description_vi:
        'Theo dõi lượt xem, thời gian xem và tăng trưởng follower để tối ưu nội dung tương lai.',
      tool: 'analytics-dashboard',
      tool_config: { platform: 'tiktok', metrics: ['views', 'watch_time', 'followers'] },
      estimated_minutes: 10,
      is_automated: false,
    },
  ],
};

// ── SOP 3: YouTube Shorts Monetization ──────────────────────────────────────

const youtubeShortsMonetization: SopDefinition = {
  slug: 'youtube-shorts-monetization',
  name_en: 'YouTube Shorts Monetization',
  name_vi: 'Kiếm Tiền Từ YouTube Shorts',
  description_en:
    'Build a high-volume YouTube Shorts channel using AI to generate 60-second vertical videos from viral topics. Cross-post to TikTok and Instagram Reels to multiply income streams.',
  description_vi:
    'Xây dựng kênh YouTube Shorts khối lượng lớn bằng AI để tạo video dọc 60 giây từ chủ đề viral. Đăng chéo lên TikTok và Instagram Reels để nhân nhiều nguồn thu nhập.',
  category: 'content',
  difficulty: 'beginner',
  estimated_revenue_min: 500,
  estimated_revenue_max: 3000,
  setup_time_minutes: 60,
  credits_per_run: 10,
  steps: [
    {
      order: 1,
      name_en: 'Find Viral Topics',
      name_vi: 'Tìm Chủ Đề Viral',
      description_en:
        'Research trending topics on YouTube Shorts, TikTok, and Google Trends for maximum viral potential.',
      description_vi:
        'Nghiên cứu chủ đề đang trending trên YouTube Shorts, TikTok và Google Trends để tối đa hóa tiềm năng viral.',
      tool: 'trend-research',
      tool_config: { sources: ['youtube-shorts', 'tiktok', 'google-trends'], top_k: 10 },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 2,
      name_en: 'Write 60s Script',
      name_vi: 'Viết Kịch Bản 60 Giây',
      description_en:
        'Write a punchy 60-second script optimized for Shorts retention.',
      description_vi:
        'Viết kịch bản 60 giây ngắn gọn, tối ưu cho tỷ lệ giữ người xem trên Shorts.',
      tool: 'ai-script-writer',
      tool_config: { model: 'openrouter', style: 'shorts', max_words: 150 },
      estimated_minutes: 10,
      is_automated: true,
    },
    {
      order: 3,
      name_en: 'Generate Vertical Video',
      name_vi: 'Tạo Video Dọc',
      description_en:
        'Create a 9:16 vertical video with voiceover and AI visuals.',
      description_vi:
        'Tạo video dọc 9:16 với giọng đọc và hình ảnh AI.',
      tool: 'ai-video-generator',
      tool_config: { aspect_ratio: '9:16', resolution: '1080x1920', add_voiceover: true },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 4,
      name_en: 'Add Hook + CTA',
      name_vi: 'Thêm Hook + CTA',
      description_en:
        'Overlay a strong opening hook text and subscribe call-to-action on the video.',
      description_vi:
        'Thêm text hook mở đầu mạnh và lời kêu gọi đăng ký vào video.',
      tool: 'video-editor',
      tool_config: { add_hook_text: true, add_cta: 'subscribe', cta_position: 'end' },
      estimated_minutes: 10,
      is_automated: false,
    },
    {
      order: 5,
      name_en: 'Upload as Short',
      name_vi: 'Tải Lên Dưới Dạng Short',
      description_en:
        'Upload to YouTube as a Short with optimized title and hashtags.',
      description_vi:
        'Tải lên YouTube dưới dạng Short với tiêu đề và hashtag tối ưu.',
      tool: 'youtube-api',
      tool_config: { category: 'Shorts', add_hashtag_shorts: true },
      estimated_minutes: 5,
      is_automated: true,
    },
    {
      order: 6,
      name_en: 'Cross-post to TikTok / Reels',
      name_vi: 'Đăng Chéo Lên TikTok / Reels',
      description_en:
        'Republish the same video to TikTok and Instagram Reels to maximize distribution.',
      description_vi:
        'Đăng lại video tương tự lên TikTok và Instagram Reels để tối đa hóa phân phối.',
      tool: 'cross-post',
      tool_config: { platforms: ['tiktok', 'instagram-reels'], remove_watermark: true },
      estimated_minutes: 5,
      is_automated: true,
    },
  ],
};

// ── SOP 4: UGC Creator Agency ────────────────────────────────────────────────

const ugcCreatorAgency: SopDefinition = {
  slug: 'ugc-creator-agency',
  name_en: 'UGC Creator Agency',
  name_vi: 'Agency Tạo Nội Dung UGC',
  description_en:
    'Start and scale a User-Generated Content (UGC) agency that produces authentic-looking ad videos for brands. Charge per video or on a monthly retainer using AI-assisted production.',
  description_vi:
    'Khởi động và mở rộng agency nội dung UGC sản xuất video quảng cáo có vẻ chân thực cho thương hiệu. Tính phí theo video hoặc hợp đồng tháng với sản xuất hỗ trợ AI.',
  category: 'business',
  difficulty: 'intermediate',
  estimated_revenue_min: 5000,
  estimated_revenue_max: 20000,
  setup_time_minutes: 180,
  credits_per_run: 20,
  steps: [
    {
      order: 1,
      name_en: 'Define Service Packages',
      name_vi: 'Xác Định Gói Dịch Vụ',
      description_en:
        'Create 3 service tiers (Starter / Growth / Pro) with clear deliverables and pricing.',
      description_vi:
        'Tạo 3 cấp dịch vụ (Starter / Growth / Pro) với kết quả bàn giao và định giá rõ ràng.',
      tool: 'template-builder',
      tool_config: { template: 'ugc-packages', tiers: 3 },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 2,
      name_en: 'Create Portfolio',
      name_vi: 'Tạo Portfolio',
      description_en:
        'Produce 3–5 sample UGC videos using AI avatars to showcase agency capabilities.',
      description_vi:
        'Sản xuất 3–5 video UGC mẫu bằng AI avatar để thể hiện năng lực của agency.',
      tool: 'ai-avatar-generator',
      tool_config: { provider: 'd-id', style: 'ugc-ad', count: 5 },
      estimated_minutes: 60,
      is_automated: true,
    },
    {
      order: 3,
      name_en: 'Set Up Client Intake Form',
      name_vi: 'Thiết Lập Form Tiếp Nhận Khách Hàng',
      description_en:
        'Create a branded intake form to collect brief, brand assets, and payment from new clients.',
      description_vi:
        'Tạo form tiếp nhận có thương hiệu để thu thập brief, tài sản thương hiệu và thanh toán từ khách hàng mới.',
      tool: 'form-builder',
      tool_config: { fields: ['brand_name', 'brief', 'target_audience', 'budget', 'assets'] },
      estimated_minutes: 20,
      is_automated: false,
    },
    {
      order: 4,
      name_en: 'Prospect via DM Outreach',
      name_vi: 'Tìm Kiếm Khách Qua DM',
      description_en:
        'Send personalized DM pitches to 20+ DTC brand founders on Instagram and LinkedIn daily.',
      description_vi:
        'Gửi tin nhắn pitch cá nhân hóa cho 20+ nhà sáng lập thương hiệu DTC trên Instagram và LinkedIn mỗi ngày.',
      tool: 'outreach-tool',
      tool_config: { platforms: ['instagram', 'linkedin'], daily_limit: 20, personalize: true },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 5,
      name_en: 'Client Onboarding',
      name_vi: 'Onboarding Khách Hàng',
      description_en:
        'Welcome new client, confirm scope, collect assets, and set timeline expectations.',
      description_vi:
        'Chào đón khách hàng mới, xác nhận phạm vi, thu thập tài sản và thiết lập kỳ vọng về timeline.',
      tool: 'crm',
      tool_config: { send_welcome_email: true, create_project_folder: true },
      estimated_minutes: 20,
      is_automated: false,
    },
    {
      order: 6,
      name_en: 'Script per Brief',
      name_vi: 'Viết Kịch Bản Theo Brief',
      description_en:
        'Generate a UGC ad script tailored to the client brief and target audience.',
      description_vi:
        'Tạo kịch bản quảng cáo UGC phù hợp với brief khách hàng và đối tượng mục tiêu.',
      tool: 'ai-script-writer',
      tool_config: { model: 'openrouter', style: 'ugc-ad', include_hook_variations: 3 },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 7,
      name_en: 'Record / Generate UGC Video',
      name_vi: 'Quay / Tạo Video UGC',
      description_en:
        'Produce the UGC video using AI avatar or self-record depending on client preference.',
      description_vi:
        'Sản xuất video UGC bằng AI avatar hoặc tự quay tùy theo sở thích khách hàng.',
      tool: 'ai-avatar-generator',
      tool_config: { provider: 'd-id', style: 'ugc', aspect_ratios: ['9:16', '1:1', '16:9'] },
      estimated_minutes: 30,
      is_automated: true,
    },
    {
      order: 8,
      name_en: 'Client Review Cycle',
      name_vi: 'Chu Kỳ Review Của Khách Hàng',
      description_en:
        'Share draft via private link and collect feedback for up to 2 revision rounds.',
      description_vi:
        'Chia sẻ bản nháp qua link riêng tư và thu thập phản hồi cho tối đa 2 vòng chỉnh sửa.',
      tool: 'review-portal',
      tool_config: { max_revisions: 2, feedback_form: true, expiry_days: 3 },
      estimated_minutes: 20,
      is_automated: false,
    },
    {
      order: 9,
      name_en: 'Deliver Finals',
      name_vi: 'Bàn Giao Bản Cuối',
      description_en:
        'Export and deliver final video files in all required formats and ratios.',
      description_vi:
        'Xuất và bàn giao file video cuối cùng ở tất cả định dạng và tỷ lệ yêu cầu.',
      tool: 'file-delivery',
      tool_config: { formats: ['mp4'], ratios: ['9:16', '1:1', '16:9'], via: 'google-drive' },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 10,
      name_en: 'Invoice + Collect Payment',
      name_vi: 'Xuất Hóa Đơn + Thu Tiền',
      description_en:
        'Send invoice and collect payment upon delivery completion.',
      description_vi:
        'Gửi hóa đơn và thu tiền khi hoàn thành bàn giao.',
      tool: 'invoicing',
      tool_config: { payment_methods: ['stripe', 'paypal', 'bank-transfer'], auto_reminder: true },
      estimated_minutes: 10,
      is_automated: false,
    },
  ],
};

// ── SOP 5: AI Avatar Video Agency ────────────────────────────────────────────

const aiAvatarVideoAgency: SopDefinition = {
  slug: 'ai-avatar-video-agency',
  name_en: 'AI Avatar Video Agency',
  name_vi: 'Agency Video AI Avatar',
  description_en:
    'Launch a premium AI avatar video agency targeting corporate clients who need spokesperson videos, training content, and multilingual communications at scale — without hiring actors.',
  description_vi:
    'Ra mắt agency video AI avatar cao cấp nhắm vào khách hàng doanh nghiệp cần video người phát ngôn, nội dung đào tạo và truyền thông đa ngôn ngữ quy mô lớn — không cần thuê diễn viên.',
  category: 'business',
  difficulty: 'intermediate',
  estimated_revenue_min: 10000,
  estimated_revenue_max: 50000,
  setup_time_minutes: 240,
  credits_per_run: 20,
  steps: [
    {
      order: 1,
      name_en: 'Define Service Tiers',
      name_vi: 'Xác Định Cấp Dịch Vụ',
      description_en:
        'Create Starter / Professional / Enterprise packages with deliverables, turnaround time, and pricing for each.',
      description_vi:
        'Tạo gói Starter / Professional / Enterprise với kết quả bàn giao, thời gian hoàn thành và định giá cho từng gói.',
      tool: 'template-builder',
      tool_config: { template: 'agency-tiers', include_sla: true },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 2,
      name_en: 'Create Demo Reel (AI Avatars)',
      name_vi: 'Tạo Demo Reel (AI Avatar)',
      description_en:
        'Produce a 2-minute demo reel showcasing diverse AI avatars across corporate, educational, and multilingual use cases.',
      description_vi:
        'Sản xuất demo reel 2 phút thể hiện các AI avatar đa dạng trong các trường hợp sử dụng doanh nghiệp, giáo dục và đa ngôn ngữ.',
      tool: 'ai-avatar-generator',
      tool_config: { provider: 'd-id', avatars: ['professional-male', 'professional-female', 'asian', 'multilingual'], duration: 120 },
      estimated_minutes: 45,
      is_automated: true,
    },
    {
      order: 3,
      name_en: 'Build Agency Website',
      name_vi: 'Xây Dựng Website Agency',
      description_en:
        'Launch a one-page agency website with demo reel, service packages, testimonials, and contact form.',
      description_vi:
        'Ra mắt website agency một trang với demo reel, gói dịch vụ, testimonial và form liên hệ.',
      tool: 'website-builder',
      tool_config: { template: 'agency', include_demo: true, include_pricing: true },
      estimated_minutes: 60,
      is_automated: false,
    },
    {
      order: 4,
      name_en: 'LinkedIn / Cold Email Outreach',
      name_vi: 'Tiếp Cận LinkedIn / Email Lạnh',
      description_en:
        'Run targeted outreach to HR directors, L&D managers, and marketing VPs at mid-market companies.',
      description_vi:
        'Chạy tiếp cận có mục tiêu đến giám đốc HR, quản lý L&D và VP Marketing tại các công ty tầm trung.',
      tool: 'outreach-tool',
      tool_config: { platforms: ['linkedin', 'email'], target_roles: ['HR Director', 'L&D Manager', 'VP Marketing'], daily_limit: 30 },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 5,
      name_en: 'Client Onboarding',
      name_vi: 'Onboarding Khách Hàng',
      description_en:
        'Collect brand kit, script preferences, avatar selection, and language requirements.',
      description_vi:
        'Thu thập bộ nhận diện thương hiệu, sở thích kịch bản, lựa chọn avatar và yêu cầu ngôn ngữ.',
      tool: 'crm',
      tool_config: { send_onboarding_kit: true, collect_brand_assets: true },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 6,
      name_en: 'Script Writing',
      name_vi: 'Viết Kịch Bản',
      description_en:
        'Draft professional video scripts aligned with client brand voice and communication goals.',
      description_vi:
        'Soạn kịch bản video chuyên nghiệp phù hợp với giọng nói thương hiệu và mục tiêu truyền thông của khách hàng.',
      tool: 'ai-script-writer',
      tool_config: { model: 'openrouter', style: 'corporate', tone: 'professional' },
      estimated_minutes: 20,
      is_automated: true,
    },
    {
      order: 7,
      name_en: 'AI Avatar Generation',
      name_vi: 'Tạo AI Avatar',
      description_en:
        'Generate high-quality AI avatar videos with the approved script and selected avatar.',
      description_vi:
        'Tạo video AI avatar chất lượng cao với kịch bản đã được duyệt và avatar đã chọn.',
      tool: 'ai-avatar-generator',
      tool_config: { provider: 'd-id', quality: 'hd', background: 'branded' },
      estimated_minutes: 20,
      is_automated: true,
    },
    {
      order: 8,
      name_en: 'Brand Overlay / Editing',
      name_vi: 'Thêm Thương Hiệu / Chỉnh Sửa',
      description_en:
        'Add client logo, lower thirds, brand colors, and CTA overlays to the generated video.',
      description_vi:
        'Thêm logo khách hàng, lower thirds, màu sắc thương hiệu và overlay CTA vào video đã tạo.',
      tool: 'video-editor',
      tool_config: { add_logo: true, add_lower_thirds: true, add_cta: true },
      estimated_minutes: 20,
      is_automated: false,
    },
    {
      order: 9,
      name_en: 'Client Approval',
      name_vi: 'Phê Duyệt Của Khách Hàng',
      description_en:
        'Send video for client review via private portal with structured feedback collection.',
      description_vi:
        'Gửi video để khách hàng review qua cổng riêng tư với thu thập phản hồi có cấu trúc.',
      tool: 'review-portal',
      tool_config: { max_revisions: 2, approval_deadline_days: 5 },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 10,
      name_en: 'Deliver + Monthly Retainer',
      name_vi: 'Bàn Giao + Hợp Đồng Tháng',
      description_en:
        'Deliver final files and offer a monthly retainer package for ongoing content production.',
      description_vi:
        'Bàn giao file cuối cùng và đề xuất gói hợp đồng tháng cho việc sản xuất nội dung liên tục.',
      tool: 'invoicing',
      tool_config: { offer_retainer: true, retainer_discount: 0.15, payment_methods: ['stripe'] },
      estimated_minutes: 20,
      is_automated: false,
    },
  ],
};

// ── Exports ──────────────────────────────────────────────────────────────────

export const OFFICIAL_SOPS: SopDefinition[] = [
  facelessYoutubeCashCow,
  tiktokCreativityProgram,
  youtubeShortsMonetization,
  ugcCreatorAgency,
  aiAvatarVideoAgency,
];
