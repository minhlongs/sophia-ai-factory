/**
 * Affiliate Disclosure Obligations — bilingual content data.
 *
 * Disclosure duties that apply when a partner publishes content carrying an
 * affiliate link. Presented factually: what to disclose and where. No legal
 * advice is given, and every jurisdiction entry says so.
 */

export const AFFILIATE_DISCLOSURE_LEGAL_NOTICE = {
  vi: 'Đây là hướng dẫn thực hành, không phải ý kiến pháp lý. Nếu bạn cần xác nhận về nghĩa vụ riêng của mình, hãy hỏi chuyên gia pháp lý tại địa phương.',
  en: 'This is practical guidance, not legal advice. Confirm your own obligations with a qualified professional where needed.',
} as const;

/** One jurisdiction's disclosure duty. */
export interface AffiliateDisclosureRegion {
  id: string;
  label: { vi: string; en: string };
  headline: { vi: string; en: string };
  /** Step-by-step duties a partner must follow. */
  steps: readonly { vi: string; en: string }[];
  /** Suggested plain-language sentence the partner can paste. */
  sampleText: { vi: string; en: string };
}

/** Disclosure duties by jurisdiction. */
export const AFFILIATE_DISCLOSURE_REGIONS: readonly AffiliateDisclosureRegion[] = [
  {
    id: 'us',
    label: { vi: 'Hoa Kỳ', en: 'United States' },
    headline: {
      vi: 'FTC — 16 C.F.R. Part 255 (Endorsement Guides)',
      en: 'FTC — 16 C.F.R. Part 255 (Endorsement Guides)',
    },
    steps: [
      {
        vi: 'Nói rõ bạn có thể nhận hoa hồng nếu người đọc mua qua liên kết của bạn.',
        en: 'State clearly that you may earn a commission if the reader buys through your link.',
      },
      {
        vi: 'Đặt dòng công khai này ngay sát liên kết, trước khi người đọc nhấp chuột.',
        en: 'Place that disclosure next to the link, before the reader clicks.',
      },
      {
        vi: 'Dùng chữ đọc được — không giấu trong chữ màu trắng, chữ cỡ nhỏ, hoặc dòng "xem thêm".',
        en: 'Use readable text — never hide it in white text, tiny fonts, or behind a "read more" link.',
      },
      {
        vi: 'Nếu video có nói miệng, phải nói rõ trong lời nói chứ không chỉ ghi dưới mô tả.',
        en: 'In video, say it out loud in the narration, not only in the description text.',
      },
    ],
    sampleText: {
      vi: 'Tôi nhận hoa hồng nếu bạn mua qua liên kết trong bài này. Điều đó không làm thay đổi giá bạn trả.',
      en: 'I earn a commission if you buy through the links in this post. It does not change the price you pay.',
    },
  },
  {
    id: 'uk',
    label: { vi: 'Vương quốc Anh', en: 'United Kingdom' },
    headline: {
      vi: 'ASA — CAP Code (quy tắc quảng cáo của Anh)',
      en: 'ASA — CAP Code (UK advertising rules)',
    },
    steps: [
      {
        vi: 'Ghi rõ mối liên kết giữa bạn và thương hiệu, để khán giả biết đây không phải lời khen độc lập.',
        en: 'Make the connection between you and the brand obvious, so the audience knows the praise is not independent.',
      },
      {
        vi: 'Công khai trước khi người xem dùng liên kết, kể cả trên video và mạng xã hội.',
        en: 'Disclose before the viewer uses the link, including in video and social content.',
      },
      {
        vi: 'Không chỉ ghi "#ad" khi người xem không hiểu thuật ngữ; dùng câu đọc hiểu được.',
        en: 'Do not rely on a bare "#ad" when your audience will not understand it — use a sentence that reads plainly.',
      },
    ],
    sampleText: {
      vi: 'Đây là nội dung quảng cáo. Tôi được trả hoa hồng khi bạn mua qua liên kết của tôi.',
      en: 'This is an advertisement. I am paid a commission when you buy through my link.',
    },
  },
  {
    id: 'eu',
    label: { vi: 'Liên minh châu Âu', en: 'European Union' },
    headline: {
      vi: 'ESMA — bối cảnh khuyến mãi tài chính, MiCA (nếu có nội dung tiền mã hóa)',
      en: 'ESMA — financial-promotion context, MiCA where crypto content is involved',
    },
    steps: [
      {
        vi: 'Nếu nội dung của bạn nói về tiền mã hóa hoặc giao dịch, xử nó như khuyến mãi tài chính.',
        en: 'If your content touches cryptocurrency or trading, treat it as a financial promotion.',
      },
      {
        vi: 'Công khai liên kết trả hoa hồng cùng mọi rủi ro liên quan đến sản phẩm bạn đề cập.',
        en: 'Disclose the paid link together with any risk that comes with the product you mention.',
      },
      {
        vi: 'Không hứa lợi nhuận, lãi suất, hoặc kết quả đầu tư cụ thể.',
        en: 'Do not promise specific profit, returns, or investment outcomes.',
      },
    ],
    sampleText: {
      vi: 'Bài này có liên kết tiếp thị và tôi nhận hoa hồng. Tiền mã hóa và giao dịch có rủi ro mất vốn.',
      en: 'This post contains a marketing link and I earn a commission. Crypto and trading carry risk of loss.',
    },
  },
  {
    id: 'vn',
    label: { vi: 'Việt Nam', en: 'Vietnam' },
    headline: {
      vi: 'Nghị định 52/2024/ND-CP — thực hành quảng bá',
      en: 'Decree 52/2024/ND-CP — practical promotion guidance',
    },
    steps: [
      {
        vi: 'Không quảng bá, mời gọi, hoặc cho phép thanh toán bằng tiền ảo trong nội dung của bạn.',
        en: 'Do not promote, solicit, or allow payment in cryptocurrency in your content.',
      },
      {
        vi: 'Vẫn công khai mối liên kết hoa hồng bằng một câu rõ ràng gần liên kết.',
        en: 'Still disclose the commission link in a clear sentence next to the link.',
      },
      {
        vi: 'Trình bày sản phẩm bằng những gì sản phẩm thật sự làm, không phải lợi nhuận hứa hẹn.',
        en: 'Describe what the product actually does, not the profit it promises.',
      },
      {
        vi: 'Nếu bạn muốn liên kết đến nội dung có khía cạnh tiền mã hóa, hãy hỏi bộ phận hỗ trợ trước.',
        en: 'If you want to link anything with a crypto angle, ask our support team first.',
      },
    ],
    sampleText: {
      vi: 'Tôi nhận hoa hồng nếu bạn mua qua liên kết trong bài này.',
      en: 'I earn a commission if you buy through the link in this post.',
    },
  },
] as const;

/** How the platform's own consent banner fits into disclosure. */
export const AFFILIATE_DISCLOSURE_CONSENT_NOTICE = {
  vi: 'Biểu ngữ cookie của Sophia AI Factory lưu cookie theo dõi của đối tác trong 30 ngày. Đối tác chỉ được tính hoa hồng khi người dùng đã đồng ý nhóm cookie "chức năng và đo lường". Cookie bị từ chối thì đường dẫn giới thiệu không được ghi nhận.',
  en: 'The Sophia AI Factory cookie banner stores partner tracking cookies for 30 days. Commission is only credited when the visitor has accepted the "functional and measurement" cookie group. If those cookies are refused, the referral is not credited.',
} as const;

/** Page intro copy. */
export const AFFILIATE_DISCLOSURE_INTRO = {
  vi: 'Khi bạn đăng nội dung có chứa liên kết đối tác, bạn phải công khai việc bạn nhận hoa hồng. Dưới đây là nghĩa vụ từng khu vực và câu mẫu để bạn dùng ngay.',
  en: 'When you publish content that carries an affiliate link, you must disclose that you are paid a commission. Below are the duties by region and sample sentences you can use right away.',
} as const;
