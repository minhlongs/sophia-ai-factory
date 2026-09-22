/**
 * Viral Hook & Video Script Prompts Engine
 *
 * Provides specialized psychological frameworks, prompt builders, and
 * deterministic fallback vaults for the 3 target revenue niches:
 *   1. AI Automation (agency lead-gen, workflow automation, cost reduction)
 *   2. E-commerce (product showcase, UGC, high-converting ad hooks)
 *   3. Solopreneur (1-person business scaling, time freedom, digital products)
 *
 * Supports 5 core hook archetypes:
 *   - Curiosity Gap
 *   - Shocking Stat
 *   - Direct Question
 *   - Problem-Solution
 *   - Contrarian
 *
 * @module tree/viral/hook-prompts
 */

import type { ViralNiche, HookArchetype, ViralHook, ViralScriptSection } from '@/seed/types/growth';

export interface NicheProfile {
  id: ViralNiche;
  name: string;
  nameVi: string;
  targetAudience: string;
  targetAudienceVi: string;
  primaryPains: string[];
  primaryPainsVi: string[];
  desires: string[];
  desiresVi: string[];
  recommendedKeywords: string[];
}

export const NICHE_PROFILES: Record<ViralNiche, NicheProfile> = {
  ai_automation: {
    id: 'ai_automation',
    name: 'AI Automation & Agency',
    nameVi: 'Tự Động Hóa AI & Agency',
    targetAudience: 'Agency owners, operational managers, developers, and B2B founders',
    targetAudienceVi: 'Chủ agency, quản lý vận hành, lập trình viên và nhà sáng lập B2B',
    primaryPains: [
      'Paying $5K-$10K/mo for human staff performing repetitive manual workflows',
      'Client churn due to slow turnaround and inconsistent execution',
      'Struggling to generate qualified inbound leads without huge ad spend',
    ],
    primaryPainsVi: [
      'Chi trả 50M-150M/tháng cho nhân sự thủ công lặp đi lặp lại',
      'Khách hàng rời bỏ vì thời gian bàn giao chậm và chất lượng thất thường',
      'Thiếu hụt lead B2B chất lượng cao nếu không đốt tiền vào quảng cáo',
    ],
    desires: [
      'Deploy 24/7 autonomous video and sales agents',
      'Scale agency capacity 10x without adding headcount',
      'Predictable $10K-$50K MRR pipeline on autopilot',
    ],
    desiresVi: [
      'Triển khai agent bán hàng và sản xuất video tự động 24/7',
      'Mở rộng quy mô agency gấp 10 lần mà không cần tăng nhân sự',
      'Dòng doanh thu định kỳ $10K-$50K MRR ổn định',
    ],
    recommendedKeywords: ['#AIAutomation', '#AgencyScaling', '#AIAgents', '#WorkflowAutomation', '#NoCodeAI'],
  },
  ecommerce: {
    id: 'ecommerce',
    name: 'E-commerce & TikTok Shop',
    nameVi: 'Thương Mại Điện Tử & TikTok Shop',
    targetAudience: 'Online store owners, TikTok Shop creators, dropshippers, brand marketers',
    targetAudienceVi: 'Chủ shop online, nhà sáng tạo TikTok Shop, dropshipper, marketer thương hiệu',
    primaryPains: [
      'Skyrocketing Facebook and TikTok ad CPMs with tanking ROAS',
      'High cost and slow turnaround of hiring UGC creators ($100-$300 per video)',
      'Product catalog videos taking weeks to produce instead of hours',
    ],
    primaryPainsVi: [
      'Chi phí quảng cáo TikTok/Facebook tăng phi mã, ROAS sụt giảm nghiêm trọng',
      'Thuê KOC/KOL làm UGC tốn kém và mất thời gian (1-5 triệu/video)',
      'Quay dựng video cho toàn bộ danh mục sản phẩm mất hàng tuần trời',
    ],
    desires: [
      'Generate 100 high-converting product videos daily on autopilot',
      'Achieve 4x-10x ROAS with irresistible video hooks and unboxing proof',
      'Dominate TikTok Shop FYP and Shopee Video feeds with viral reach',
    ],
    desiresVi: [
      'Tự động tạo 100 video sản phẩm chuyển đổi cao mỗi ngày',
      'Tối ưu ROAS từ 4x đến 10x nhờ hook cuốn hút và visual chân thực',
      'Chiếm lĩnh xu hướng TikTok Shop và Shopee Video thu hút hàng triệu view',
    ],
    recommendedKeywords: ['#TikTokShop', '#EcommerceHacks', '#Dropshipping', '#UGCAds', '#EcommerceMarketing'],
  },
  solopreneur: {
    id: 'solopreneur',
    name: 'Solopreneur & 1-Person Business',
    nameVi: 'Kinh Doanh Độc Lập & Solopreneur',
    targetAudience: 'Solo founders, course creators, digital product sellers, freelancers',
    targetAudienceVi: 'Solo founder, người bán sản phẩm số, người dạy khóa học, freelancer',
    primaryPains: [
      'Trapped in the time-for-money hamster wheel with zero leverage',
      'Imposter syndrome or fear of showing face on camera',
      'Overwhelmed by marketing, content creation, and sales funnels alone',
    ],
    primaryPainsVi: [
      'Mắc kẹt trong vòng xoáy bán thời gian đổi tiền mà không có đòn bẩy',
      'Ngại xuất hiện trước ống kính hoặc không có thời gian tự quay video',
      'Quá tải khi phải tự làm nội dung, marketing và chốt đơn một mình',
    ],
    desires: [
      'Build a faceless short-video empire hitting $5K-$10K MRR',
      'Complete time and location freedom powered by autonomous AI systems',
      'Scale high-ticket digital products without hiring employees',
    ],
    desiresVi: [
      'Xây dựng kênh video không lộ mặt đạt cột mốc $5K-$10K MRR',
      'Tự do thời gian và địa điểm nhờ hệ thống AI vận hành tự động',
      'Bán sản phẩm số và dịch vụ giá trị cao mà không cần nhân viên',
    ],
    recommendedKeywords: ['#Solopreneur', '#1PersonBusiness', '#PassiveIncome', '#FacelessChannel', '#SideHustle'],
  },
};

export interface ArchetypeDefinition {
  archetype: HookArchetype;
  name: string;
  nameVi: string;
  psychologicalMechanism: string;
  idealDurationSec: number;
  deliveryStyle: string;
}

export const ARCHETYPE_DEFINITIONS: Record<HookArchetype, ArchetypeDefinition> = {
  curiosity_gap: {
    archetype: 'curiosity_gap',
    name: 'Curiosity Gap',
    nameVi: 'Khoảng Trống Tò Mò',
    psychologicalMechanism: 'Withholds a critical piece of information, triggering a dopamine loop that forces retention.',
    idealDurationSec: 3,
    deliveryStyle: 'Intriguing, mysterious, fast-paced whisper or punchy assertion.',
  },
  shock_stat: {
    archetype: 'shock_stat',
    name: 'Shocking Statistic',
    nameVi: 'Số Liệu Gây Sốc',
    psychologicalMechanism: 'Presents an undeniable numerical metric that shatters the viewer’s cognitive baseline.',
    idealDurationSec: 4,
    deliveryStyle: 'Authoritative, urgent, accompanied by bold numerical overlay.',
  },
  direct_question: {
    archetype: 'direct_question',
    name: 'Direct Question',
    nameVi: 'Câu Hỏi Trực Diện',
    psychologicalMechanism: 'Forces the viewer’s brain into immediate self-examination and binary agreement.',
    idealDurationSec: 3,
    deliveryStyle: 'Direct eye contact, conversational, piercing tone.',
  },
  problem_solution: {
    archetype: 'problem_solution',
    name: 'Problem-Solution Pivot',
    nameVi: 'Đảo Ngược Vấn Đề - Giải Pháp',
    psychologicalMechanism: 'Immediately triggers loss aversion by naming the exact friction point, followed by immediate relief.',
    idealDurationSec: 5,
    deliveryStyle: 'Frustrated initial cadence rapidly shifting to triumphant clarity.',
  },
  contrarian: {
    archetype: 'contrarian',
    name: 'Contrarian Stance',
    nameVi: 'Quan Điểm Ngược Dòng',
    psychologicalMechanism: 'Debunks widespread industry consensus, triggering pattern interrupt and curiosity.',
    idealDurationSec: 4,
    deliveryStyle: 'Bold, provocative, unapologetic call-out.',
  },
};

export const DETERMINISTIC_HOOK_VAULT: ViralHook[] = [
  // AI Automation
  {
    id: 'hook_ai_curiosity',
    niche: 'ai_automation',
    archetype: 'curiosity_gap',
    hookText: 'Most marketing agencies are hiding this one AI workflow from their clients...',
    hookTextVi: 'Hầu hết các agency marketing đang giấu khách hàng quy trình tự động hóa AI này...',
    estimatedSeconds: 3,
    expectedRetentionScore: 94,
    psychologicalTrigger: 'Curiosity Gap: Information asymmetry and insider secret framing.',
    tags: ['agency-secret', 'ai-workflow', 'curiosity'],
  },
  {
    id: 'hook_ai_shock_stat',
    niche: 'ai_automation',
    archetype: 'shock_stat',
    hookText: '83% of creative agencies will be replaced by 3-person AI operations by next year.',
    hookTextVi: '83% agency sáng tạo sẽ bị thay thế bởi đội ngũ AI chỉ gồm 3 người vào năm tới.',
    estimatedSeconds: 4,
    expectedRetentionScore: 91,
    psychologicalTrigger: 'Shocking Stat: Existential disruption urgency.',
    tags: ['stat', 'urgency', 'industry-shift'],
  },
  {
    id: 'hook_ai_direct_question',
    niche: 'ai_automation',
    archetype: 'direct_question',
    hookText: 'Are you still paying $4,000 a month for video editors who deliver 3 days late?',
    hookTextVi: 'Bạn vẫn đang trả 30 triệu mỗi tháng cho editor video mà vẫn bị trễ hạn 3 ngày?',
    estimatedSeconds: 4,
    expectedRetentionScore: 89,
    psychologicalTrigger: 'Direct Question: Pain agitation and financial waste call-out.',
    tags: ['cost-cutting', 'pain-point', 'direct-address'],
  },
  {
    id: 'hook_ai_problem_solution',
    niche: 'ai_automation',
    archetype: 'problem_solution',
    hookText: 'Video editing used to eat 20 hours a week. Now our AI agent outputs 50 videos in 12 minutes.',
    hookTextVi: 'Dựng video từng ngốn 20 tiếng mỗi tuần. Giờ AI agent của tôi xuất 50 video chỉ trong 12 phút.',
    estimatedSeconds: 5,
    expectedRetentionScore: 96,
    psychologicalTrigger: 'Problem-Solution: Dramatic before/after time compression.',
    tags: ['before-after', 'productivity', 'efficiency'],
  },
  {
    id: 'hook_ai_contrarian',
    niche: 'ai_automation',
    archetype: 'contrarian',
    hookText: 'Stop hiring junior media buyers. Here is why autonomous agents run ads 10x cheaper.',
    hookTextVi: 'Đừng thuê thêm media buyer nữa. Đây là lý do agent tự động chạy quảng cáo rẻ hơn gấp 10 lần.',
    estimatedSeconds: 4,
    expectedRetentionScore: 93,
    psychologicalTrigger: 'Contrarian: Counter-intuitive advice debunking standard hiring playbooks.',
    tags: ['contrarian', 'anti-hiring', 'autonomous-agents'],
  },

  // E-commerce
  {
    id: 'hook_ecom_curiosity',
    niche: 'ecommerce',
    archetype: 'curiosity_gap',
    hookText: 'This $14 gadget generated 1.2 million views on TikTok with this 3-second hook trick.',
    hookTextVi: 'Món đồ gia dụng 199k này đạt 1,2 triệu view trên TikTok nhờ đúng tuyệt chiêu mở đầu 3 giây này.',
    estimatedSeconds: 4,
    expectedRetentionScore: 95,
    psychologicalTrigger: 'Curiosity Gap: Micro-case study with exact virality formula.',
    tags: ['tiktok-shop', 'viral-hack', 'case-study'],
  },
  {
    id: 'hook_ecom_shock_stat',
    niche: 'ecommerce',
    archetype: 'shock_stat',
    hookText: 'Stores using AI video cataloging saw a 312% increase in checkout conversions this month.',
    hookTextVi: 'Các shop ứng dụng AI tạo video sản phẩm đã tăng 312% tỷ lệ chốt đơn ngay trong tháng này.',
    estimatedSeconds: 4,
    expectedRetentionScore: 88,
    psychologicalTrigger: 'Shocking Stat: High-converting revenue proof.',
    tags: ['conversion-rate', 'ecom-stats', 'roi'],
  },
  {
    id: 'hook_ecom_direct_question',
    niche: 'ecommerce',
    archetype: 'direct_question',
    hookText: 'Why are you still burning $50 a day on ads when TikTok organic is handing out free reach?',
    hookTextVi: 'Tại sao bạn vẫn đốt 1 triệu tiền ads mỗi ngày trong khi TikTok đang thả view tự nhiên miễn phí?',
    estimatedSeconds: 4,
    expectedRetentionScore: 92,
    psychologicalTrigger: 'Direct Question: Financial regret & missed opportunity framing.',
    tags: ['ad-spend', 'organic-reach', 'ecom-growth'],
  },
  {
    id: 'hook_ecom_problem_solution',
    niche: 'ecommerce',
    archetype: 'problem_solution',
    hookText: 'Shoppers scroll past boring product photos. But this 15-second AI video demo sold out our warehouse.',
    hookTextVi: 'Khách hàng lướt qua ảnh sản phẩm nhàm chán. Nhưng video AI trải nghiệm 15 giây này đã bán sạch kho hàng.',
    estimatedSeconds: 5,
    expectedRetentionScore: 97,
    psychologicalTrigger: 'Problem-Solution: Visual contrast of static photo failure vs video sellout.',
    tags: ['sold-out', 'visual-contrast', 'ugc-proof'],
  },
  {
    id: 'hook_ecom_contrarian',
    niche: 'ecommerce',
    archetype: 'contrarian',
    hookText: 'Professional camera crews are killing your TikTok Shop sales. Raw AI UGC converts 4x better.',
    hookTextVi: 'Thuê ekip quay xịn sò đang bóp nghẹt doanh số TikTok Shop của bạn. Video UGC chân thực chuyển đổi cao gấp 4 lần.',
    estimatedSeconds: 4,
    expectedRetentionScore: 94,
    psychologicalTrigger: 'Contrarian: Anti-perfectionism in social commerce.',
    tags: ['ugc', 'anti-agency', 'raw-vs-polished'],
  },

  // Solopreneur
  {
    id: 'hook_solo_curiosity',
    niche: 'solopreneur',
    archetype: 'curiosity_gap',
    hookText: 'How I scaled a 1-person software business to $5,000 MRR without ever showing my face.',
    hookTextVi: 'Cách tôi đưa doanh nghiệp 1 người cán mốc $5.000 MRR mà không cần lộ mặt lấy một giây.',
    estimatedSeconds: 4,
    expectedRetentionScore: 98,
    psychologicalTrigger: 'Curiosity Gap: Faceless scale dream achievement.',
    tags: ['faceless-business', '5k-mrr', 'solopreneur'],
  },
  {
    id: 'hook_solo_shock_stat',
    niche: 'solopreneur',
    archetype: 'shock_stat',
    hookText: '90% of solo creators fail because they spend 6 hours creating content that gets 42 views.',
    hookTextVi: '90% người làm nội dung solo bỏ cuộc vì cặm cụi 6 tiếng làm video chỉ nhận lại 42 lượt xem.',
    estimatedSeconds: 5,
    expectedRetentionScore: 90,
    psychologicalTrigger: 'Shocking Stat: Resonating frustration and shared creator trauma.',
    tags: ['creator-burnout', 'statistics', 'harsh-truth'],
  },
  {
    id: 'hook_solo_direct_question',
    niche: 'solopreneur',
    archetype: 'direct_question',
    hookText: 'What if you could publish 3 viral videos a day while working a 9-to-5 job?',
    hookTextVi: 'Chuyện gì xảy ra nếu bạn có thể đăng 3 video lên xu hướng mỗi ngày ngay cả khi đang làm văn phòng?',
    estimatedSeconds: 4,
    expectedRetentionScore: 93,
    psychologicalTrigger: 'Direct Question: Time-freedom aspiration and side-hustle feasibility.',
    tags: ['side-hustle', 'time-freedom', 'multiplication'],
  },
  {
    id: 'hook_solo_problem_solution',
    niche: 'solopreneur',
    archetype: 'problem_solution',
    hookText: 'I used to burn out writing scripts until 2 AM. Now my AI assistant writes and scripts everything in 60 seconds.',
    hookTextVi: 'Từng kiệt sức vì viết kịch bản đến 2 giờ sáng. Giờ trợ lý AI của tôi lên kịch bản chuẩn SEO chỉ trong 60 giây.',
    estimatedSeconds: 5,
    expectedRetentionScore: 95,
    psychologicalTrigger: 'Problem-Solution: Eradicating creative exhaustion with instant automation.',
    tags: ['burnout-cure', 'scripting-automation', '60-seconds'],
  },
  {
    id: 'hook_solo_contrarian',
    niche: 'solopreneur',
    archetype: 'contrarian',
    hookText: 'You don’t need a team of 10 to make $100K. You need 1 person and 5 autonomous AI agents.',
    hookTextVi: 'Bạn không cần đội ngũ 10 người để kiếm 2 tỷ một năm. Bạn chỉ cần 1 người và 5 AI agent tự động hóa.',
    estimatedSeconds: 4,
    expectedRetentionScore: 96,
    psychologicalTrigger: 'Contrarian: The ultra-lean solo operator paradigm shift.',
    tags: ['lean-scale', 'ai-stack', 'paradigm-shift'],
  },
];

export interface ScriptTemplateData {
  hookId: string;
  niche: ViralNiche;
  title: string;
  titleVi: string;
  sections: ViralScriptSection[];
  ctaText: string;
  ctaTextVi: string;
}

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
  {
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
  },
];

/**
 * Build LLM prompt for generating psychological short-form viral hooks.
 */
export function buildHookGenerationPrompt(
  niche: ViralNiche,
  archetype?: HookArchetype,
  customTopic?: string,
  locale: 'en' | 'vi' = 'en',
): { systemPrompt: string; userPrompt: string } {
  const profile = NICHE_PROFILES[niche];
  const archetypeInfo = archetype ? ARCHETYPE_DEFINITIONS[archetype] : null;

  const systemPrompt = [
    'You are the Chief Growth Viral Architect at Sophia AI Factory.',
    'Your specialty is engineering hyper-engaging opening hooks (first 3-5 seconds) for TikTok, YouTube Shorts, and X.',
    'Every hook must trigger intense curiosity, emotional pattern interruption, or cognitive dissonance.',
    'You adhere strictly to short-form retention mechanics: 0 fluff, punchy rhythm, vivid vocabulary, high stakes.',
    locale === 'vi'
      ? 'Output both English and natural, high-converting Vietnamese versions.'
      : 'Output compelling English copy with localized cultural resonance.',
  ].join(' ');

  const userPrompt = [
    `Target Niche: ${profile.name} (${profile.nameVi})`,
    `Target Audience: ${profile.targetAudience}`,
    `Audience Pain Points: ${profile.primaryPains.join('; ')}`,
    `Audience Core Desires: ${profile.desires.join('; ')}`,
    archetypeInfo
      ? `Required Hook Archetype: ${archetypeInfo.name} (${archetypeInfo.nameVi}) - Mechanism: ${archetypeInfo.psychologicalMechanism}`
      : 'Generate 5 variants spanning the 5 core archetypes: Curiosity Gap, Shocking Stat, Direct Question, Problem-Solution, and Contrarian.',
    customTopic ? `Focus Topic / Offer: ${customTopic}` : '',
    'Provide output in structured JSON matching the ViralHook schema.',
  ]
    .filter(Boolean)
    .join('\n');

  return { systemPrompt, userPrompt };
}

/**
 * Build LLM prompt for full viral short-form video script generation.
 */
export function buildScriptPrompt(
  niche: ViralNiche,
  hook: ViralHook,
  targetDurationSec: 15 | 30 | 60 = 30,
  locale: 'en' | 'vi' = 'en',
): { systemPrompt: string; userPrompt: string } {
  const profile = NICHE_PROFILES[niche];

  const systemPrompt = [
    'You are a world-class viral video copywriter for short-form video (TikTok, YouTube Shorts, X Reels).',
    'Write high-retention video scripts that guide the viewer from pattern interrupt to qualified funnel signup.',
    `Target duration is exactly ${targetDurationSec} seconds.`,
    'Sections must include: hook (3-5s), problem agitation (5-8s), core solution (10-15s), social proof/demo (4-5s), and clear CTA (4-5s).',
    locale === 'vi' ? 'Provide bilingual English and conversational Vietnamese.' : 'Provide high-impact English copy.',
  ].join(' ');

  const userPrompt = [
    `Niche: ${profile.name}`,
    `Selected Hook: "${hook.hookText}" (Vietnamese: "${hook.hookTextVi}")`,
    `Hook Archetype: ${hook.archetype}`,
    `Target Duration: ${targetDurationSec} seconds`,
    'Structure each section with narration, visualCue, onScreenText, and durationSec.',
    'End with an irresistible Call-To-Action directing viewers to our Telegram sales bot or website.',
  ].join('\n');

  return { systemPrompt, userPrompt };
}
