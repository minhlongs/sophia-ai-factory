/**
 * /api/creative-studio/scripts/templates
 *
 * GET — list available script templates (campaign templates as script generators)
 * POST — generate a script from a template + user inputs
 *
 * Auth: requires valid Better Auth session
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { CAMPAIGN_TEMPLATES, getTemplateById } from '@/land/templates/campaign-templates';
import { TIER_RANK, type Tier } from '@/seed/types';

// Minimum tier required per template category
// Higher categories require higher tiers to access
const CATEGORY_MIN_TIER: Record<string, Tier> = {
  welcome: 'BASIC',
  product: 'BASIC',
  seasonal: 'BASIC',
  promotion: 'PREMIUM',
  viral: 'ENTERPRISE',
};

/** Check if user's tier meets the minimum required tier */
function tierMeetsMinimum(userTier: Tier, minTier: Tier): boolean {
  return (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[minTier] ?? 0);
}

interface ScriptScene {
  id: number;
  type: 'intro' | 'hook' | 'body' | 'cta' | 'outro';
  text: string;
  durationSec: number;
  visualHint: string;
}

interface GeneratedScript {
  id: string;
  templateId: string;
  templateName: string;
  topic: string;
  brandName: string;
  tone: string;
  language: 'en' | 'vi';
  totalDurationSec: number;
  scenes: ScriptScene[];
  fullScript: string;
  wordCount: number;
  createdAt: string;
}

export const dynamic = 'force-dynamic';

const categorySchema = z.enum(['welcome', 'product', 'seasonal', 'promotion', 'viral']);
const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(1).max(maxLength).optional(),
  );

const generateScriptSchema = z.object({
  templateId: z.string().trim().min(1).max(100),
  topic: z.string().trim().min(1).max(500),
  brandName: optionalText(100),
  targetDuration: z.number().int().min(10).max(300).optional().default(30),
  tone: optionalText(80),
  language: z.enum(['en', 'vi']).optional().default('vi'),
});

// GET — list available script templates
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    let templates = CAMPAIGN_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      icon: t.icon,
      defaults: t.defaults,
    }));

    if (category && category !== 'all') {
      const parsedCategory = categorySchema.safeParse(category);
      if (!parsedCategory.success) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      templates = templates.filter((t) => t.category === category);
    }

    // Tier gate: filter out templates whose category minimum exceeds user tier
    const userTier = await resolveUserTier(user.id);
    if (TIER_RANK[userTier] === undefined) {
      return NextResponse.json(
        { error: 'Script templates require a valid tier' },
        { status: 403 },
      );
    }
    const userRank = TIER_RANK[userTier];
    templates = templates.filter((t) => {
      const minTier = CATEGORY_MIN_TIER[t.category];
      if (!minTier) return true;
      return userRank >= TIER_RANK[minTier];
    });

    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch script templates' },
      { status: 500 },
    );
  }
}

// POST — generate a script from template + inputs
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tier = await resolveUserTier(user.id);

    // Reject completely invalid tiers early
    if (TIER_RANK[tier] === undefined) {
      return NextResponse.json(
        { error: 'Script generation requires a valid tier' },
        { status: 403 },
      );
    }
    const userRank = TIER_RANK[tier];

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = generateScriptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid script input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { templateId, topic, brandName, targetDuration, tone, language } = parsed.data;

    const template = getTemplateById(templateId);
    if (!template) {
      return NextResponse.json(
        { error: `Template not found: ${templateId}` },
        { status: 404 },
      );
    }

    // Per-template tier gate: deny if user tier can't access this category
    const minTier = CATEGORY_MIN_TIER[template.category];
    if (minTier && !tierMeetsMinimum(tier, minTier)) {
      return NextResponse.json(
        {
          error: 'Insufficient tier for this template category',
          requiredTier: minTier,
          currentTier: tier,
        },
        { status: 403 },
      );
    }

    // Build the generated script
    const script = buildScriptFromTemplate({
      template,
      topic,
      brandName: brandName || (language === 'vi' ? 'Chúng tôi' : 'Our Channel'),
      targetDuration,
      tone: tone || template.defaults.tone,
      language,
    });

    return NextResponse.json({ script }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate script' },
      { status: 500 },
    );
  }
}

// ─── Script Builder ──────────────────────────────────────────────────────────

interface BuildScriptOptions {
  template: {
    id: string;
    name: string;
    category: string;
    defaults: {
      title: string;
      audience: string;
      tone: string;
      suggestedDuration: number;
    };
  };
  topic: string;
  brandName: string;
  targetDuration: number;
  tone: string;
  language: 'en' | 'vi';
}

function buildScriptFromTemplate(opts: BuildScriptOptions): GeneratedScript {
  const { template, topic, brandName, targetDuration, tone, language } = opts;
  const isVi = language === 'vi';

  const sceneConfigs = getSceneConfigs(template.category, targetDuration, isVi);

  const scenes: ScriptScene[] = sceneConfigs.map((cfg, idx) => ({
    id: idx + 1,
    type: cfg.type,
    text: cfg.text(topic, brandName, tone, isVi),
    durationSec: cfg.duration,
    visualHint: cfg.visualHint(isVi),
  }));

  const fullScript = scenes.map((s) => s.text).join('\n\n');
  const wordCount = fullScript.split(/\s+/).filter(Boolean).length;

  return {
    id: crypto.randomUUID(),
    templateId: template.id,
    templateName: template.name,
    topic,
    brandName,
    tone,
    language,
    totalDurationSec: scenes.reduce((sum, s) => sum + s.durationSec, 0),
    scenes,
    fullScript,
    wordCount,
    createdAt: new Date().toISOString(),
  };
}

interface SceneConfig {
  type: ScriptScene['type'];
  duration: number;
  text: (topic: string, brand: string, tone: string, isVi: boolean) => string;
  visualHint: (isVi: boolean) => string;
}

function getSceneConfigs(
  category: string,
  totalDuration: number,
  isVi: boolean,
): SceneConfig[] {
  const allocations: Record<string, number[]> = {
    welcome: [5, 15, 8, 7],
    product: [5, 15, 12, 8],
    seasonal: [5, 15, 8, 7],
    promotion: [3, 10, 8, 4],
    viral: [3, 10, 8, 4],
  };

  const raw = allocations[category] || allocations['welcome'];
  const totalRaw = raw.reduce((a, b) => a + b, 0);
  const scale = totalDuration / totalRaw;
  const durations = raw.map((d) => Math.max(3, Math.round(d * scale)));

  const hookTexts: Record<
    string,
    (topic: string, brand: string, tone: string, isVi: boolean) => string
  > = {
    welcome: (topic, brand, _tone, vi) =>
      vi
        ? `[Chào đón]\nChào mừng bạn đến với ${brand}! Bạn đã đến đúng nơi rồi đó. "${topic}" là thứ chúng tôi rất hào hứng chia sẻ cùng bạn. Cùng khám phá ngay!`
        : `[Welcome]\nWelcome to ${brand}! You're in the right place. "${topic}" is something we're excited to share with you. Let's dive right in!`,
    product: (topic, brand, _tone, vi) =>
      vi
        ? `[Giới thiệu sản phẩm]\nHôm nay là ngày đặc biệt! ${brand} chính thức giới thiệu "${topic}". Một sản phẩm được phát triển với công nghệ tiên tiến nhất, mang đến trải nghiệm chưa từng có.`
        : `[Product Intro]\nToday is special! ${brand} is officially launching "${topic}". A product built with cutting-edge technology, delivering an experience like never before.`,
    seasonal: (topic, brand, _tone, vi) =>
      vi
        ? `[Mùa lễ hội]\nKhông khí lễ hội đã đến! ${brand} mang đến "${topic}" với những điều đặc biệt nhất dành cho bạn. Hãy cùng tận hưởng khoảnh khắc ý nghĩa này!`
        : `[Seasonal]\nThe festive season is here! ${brand} brings you "${topic}" with something truly special. Let's enjoy this meaningful moment together!`,
    promotion: (topic, brand, _tone, vi) =>
      vi
        ? `[Khuyến mãi]\nCHỈ CÒN ${topic}! ${brand} mang đến ưu đãi hấp dẫn nhất năm. Nhanh tay kẻo lỡ — số lượng có hạn!`
        : `[Promo Hook]\nEXCLUSIVE DEAL: ${topic} at ${brand}! The best offer of the year — limited time only. Act fast before it's gone!`,
    viral: (topic, brand, _tone, vi) =>
      vi
        ? `[Nội dung viral]\nBạn sẽ KHÔNG TIN được điều này về "${topic}"! ${brand} tiết lộ bí mật mà ai cũng muốn biết. Chia sẻ ngay cho bạn bè!`
        : `[Viral Hook]\nYou won't BELIEVE this about "${topic}"! ${brand} reveals a secret everyone wants to know. Share it with your friends now!`,
  };

  const bodyTexts: Record<
    string,
    (topic: string, brand: string, tone: string, isVi: boolean) => string
  > = {
    welcome: (topic, brand, tone, vi) =>
      vi
        ? `[Nội dung chính]\nTại ${brand}, chúng tôi cam kết mang đến giá trị tốt nhất cho bạn. "${topic}" là điểm khởi đầu cho hành trình tuyệt vời. Bạn sẽ học được nhiều điều mới mỗi ngày. Đừng quên bấm chuông thông báo để không bỏ lỡ bất kỳ video nào!`
        : `[Main Content]\nAt ${brand}, we're committed to bringing you the best value. "${topic}" is just the beginning of an amazing journey. You'll learn something new every day. Don't forget to hit the notification bell!`,
    product: (topic, brand, tone, vi) =>
      vi
        ? `[Chi tiết sản phẩm]\nĐiểm đặc biệt của "${topic}": Thiết kế tối ưu trải nghiệm người dùng. Chất lượng vượt trội với giá tốt nhất. ${brand} luôn lắng nghe phản hồi để không ngừng cải tiến. Đây chính là lựa chọn thông minh mà bạn đang tìm kiếm!`
        : `[Product Details]\nWhat makes "${topic}" special: Optimized user experience design. Superior quality at the best price. ${brand} continuously improves based on your feedback. This is the smart choice you've been looking for!`,
    seasonal: (topic, brand, tone, vi) =>
      vi
        ? `[Nội dung theo mùa]\nMùa ${topic} là thời điểm hoàn hảo để thể hiện tình cảm. ${brand} chuẩn bị những món quà ý nghĩa nhất. Hãy dành tặng cho người thân yêu những điều đặc biệt trong dịp đặc biệt này!`
        : `[Seasonal Content]\nThe ${topic} season is the perfect time to show your care. ${brand} has prepared the most meaningful gifts. Give something special to your loved ones this season!`,
    promotion: (topic, brand, tone, vi) =>
      vi
        ? `[Chi tiết ưu đãi]\n${topic} tại ${brand} — không phải là ưu đãi thông thường. Giảm giá cực sâu, quà tặng hấp dẫn, freeship toàn quốc. Chỉ trong thời gian có hạn. Ghé ngay website của chúng tôi!`
        : `[Promo Details]\n${topic} at ${brand} — this is no ordinary deal. Deep discounts, exciting gifts, free shipping nationwide. Limited time only. Visit our website now!`,
    viral: (topic, brand, tone, vi) =>
      vi
        ? `[Bí mật được tiết lộ]\nĐây là điều ${brand} muốn chia sẻ với bạn về "${topic}". Nó thay đổi hoàn toàn cách bạn nhìn nhận vấn đề này. Hãy thử ngay và chia sẻ kết quả với chúng tôi!`
        : `[Secret Revealed]\nThis is what ${brand} wants to share with you about "${topic}". It completely changes how you see this topic. Try it now and share your results with us!`,
  };

  return [
    {
      type: 'intro',
      duration: durations[0],
      text: (t, b, _tone, vi) =>
        vi
          ? `[Mở đầu]\nXin chào! Hôm nay tại kênh của ${b}, chúng ta cùng khám phá "${t}". Đừng bỏ lỡ nhé!`
          : `[Intro]\nHey there! Today on ${b}, we're exploring "${t}". You don't want to miss this!`,
      visualHint: (vi) =>
        vi
          ? 'Mở đầu — logo thương hiệu hiện rõ trên nền gradient'
          : 'Intro — brand logo prominent on gradient background',
    },
    {
      type: 'hook',
      duration: durations[1],
      text: (t, b, _tone, vi) => (hookTexts[category] || hookTexts['welcome'])(t, b, _tone, vi),
      visualHint: (vi) =>
        vi
          ? 'Hook — hình ảnh gây chú ý, chữ overlay lớn với insight bất ngờ'
          : 'Hook — attention-grabbing image, large text overlay with surprising insight',
    },
    {
      type: 'body',
      duration: durations[2],
      text: (t, b, tone, vi) => (bodyTexts[category] || bodyTexts['welcome'])(t, b, tone, vi),
      visualHint: (vi) =>
        vi
          ? 'Body — hình ảnh minh họa, infographic, hoặc demo sản phẩm'
          : 'Body — illustrative images, infographics, or product demo',
    },
    {
      type: 'cta',
      duration: durations[3],
      text: (_t, b, tone, vi) =>
        vi
          ? `[Kêu gọi hành động]\nNếu video này hữu ích, hãy THÍCH và ĐĂNG KÝ kênh ${b}! Để không bỏ lỡ nội dung mới. Bình luận bên dưới để chia sẻ suy nghĩ của bạn. Cảm ơn bạn đã theo dõi!`
          : `[Call to Action]\nIf this video was helpful, LIKE and SUBSCRIBE to ${b}! Don't miss new content. Drop a comment below to share your thoughts. Thanks for watching!`,
      visualHint: (vi) =>
        vi
          ? 'CTA — nút subscribe, mạng xã hội, thông tin liên hệ nổi bật'
          : 'CTA — subscribe button, social handles, contact info highlighted',
    },
  ];
}
