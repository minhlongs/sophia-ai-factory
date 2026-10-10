import type { ScriptScene } from './template-types';

export interface SceneConfig {
  type: ScriptScene['type'];
  duration: number;
  text: (topic: string, brand: string, tone: string, isVi: boolean) => string;
  visualHint: (isVi: boolean) => string;
}

const ALLOCATIONS: Record<string, number[]> = {
  welcome: [5, 15, 8, 7],
  product: [5, 15, 12, 8],
  seasonal: [5, 15, 8, 7],
  promotion: [3, 10, 8, 4],
  viral: [3, 10, 8, 4],
};

const HOOK_TEXTS: Record<
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

const BODY_TEXTS: Record<
  string,
  (topic: string, brand: string, tone: string, isVi: boolean) => string
> = {
  welcome: (topic, brand, _tone, vi) =>
    vi
      ? `[Nội dung chính]\nTại ${brand}, chúng tôi cam kết mang đến giá trị tốt nhất cho bạn. "${topic}" là điểm khởi đầu cho hành trình tuyệt vời. Bạn sẽ học được nhiều điều mới mỗi ngày. Đừng quên bấm chuông thông báo để không bỏ lỡ bất kỳ video nào!`
      : `[Main Content]\nAt ${brand}, we're committed to bringing you the best value. "${topic}" is just the beginning of an amazing journey. You'll learn something new every day. Don't forget to hit the notification bell!`,
  product: (topic, brand, _tone, vi) =>
    vi
      ? `[Chi tiết sản phẩm]\nĐiểm đặc biệt của "${topic}": Thiết kế tối ưu trải nghiệm người dùng. Chất lượng vượt trội với giá tốt nhất. ${brand} luôn lắng nghe phản hồi để không ngừng cải tiến. Đây chính là lựa chọn thông minh mà bạn đang tìm kiếm!`
      : `[Product Details]\nWhat makes "${topic}" special: Optimized user experience design. Superior quality at the best price. ${brand} continuously improves based on your feedback. This is the smart choice you've been looking for!`,
  seasonal: (topic, brand, _tone, vi) =>
    vi
      ? `[Nội dung theo mùa]\nMùa ${topic} là thời điểm hoàn hảo để thể hiện tình cảm. ${brand} chuẩn bị những món quà ý nghĩa nhất. Hãy dành tặng cho người thân yêu những điều đặc biệt trong dịp đặc biệt này!`
      : `[Seasonal Content]\nThe ${topic} season is the perfect time to show your care. ${brand} has prepared the most meaningful gifts. Give something special to your loved ones this season!`,
  promotion: (topic, brand, _tone, vi) =>
    vi
      ? `[Chi tiết ưu đãi]\n${topic} tại ${brand} — không phải là ưu đãi thông thường. Giảm giá cực sâu, quà tặng hấp dẫn, freeship toàn quốc. Chỉ trong thời gian có hạn. Ghé ngay website của chúng tôi!`
      : `[Promo Details]\n${topic} at ${brand} — this is no ordinary deal. Deep discounts, exciting gifts, free shipping nationwide. Limited time only. Visit our website now!`,
  viral: (topic, brand, _tone, vi) =>
    vi
      ? `[Bí mật được tiết lộ]\nĐây là điều ${brand} muốn chia sẻ với bạn về "${topic}". Nó thay đổi hoàn toàn cách bạn nhìn nhận vấn đề này. Hãy thử ngay và chia sẻ kết quả với chúng tôi!`
      : `[Secret Revealed]\nThis is what ${brand} wants to share with you about "${topic}". It completely changes how you see this topic. Try it now and share your results with us!`,
};

export function getSceneConfigs(
  category: string,
  totalDuration: number,
  _isVi: boolean,
): SceneConfig[] {
  const raw = ALLOCATIONS[category] || ALLOCATIONS['welcome'];
  const totalRaw = raw.reduce((a, b) => a + b, 0);
  const scale = totalDuration / totalRaw;
  const durations = raw.map((d) => Math.max(3, Math.round(d * scale)));

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
      text: (t, b, tone, vi) => (HOOK_TEXTS[category] || HOOK_TEXTS['welcome'])(t, b, tone, vi),
      visualHint: (vi) =>
        vi
          ? 'Hook — hình ảnh gây chú ý, chữ overlay lớn với insight bất ngờ'
          : 'Hook — attention-grabbing image, large text overlay with surprising insight',
    },
    {
      type: 'body',
      duration: durations[2],
      text: (t, b, tone, vi) => (BODY_TEXTS[category] || BODY_TEXTS['welcome'])(t, b, tone, vi),
      visualHint: (vi) =>
        vi
          ? 'Body — hình ảnh minh họa, infographic, hoặc demo sản phẩm'
          : 'Body — illustrative images, infographics, or product demo',
    },
    {
      type: 'cta',
      duration: durations[3],
      text: (_t, b, _tone, vi) =>
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
