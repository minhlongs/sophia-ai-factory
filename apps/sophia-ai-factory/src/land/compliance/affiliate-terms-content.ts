/**
 * Affiliate Program Terms — bilingual content data (barrel).
 *
 * Plain-language terms for the public `/affiliate-terms` page. Vietnamese is
 * the contractual language, so every entry carries a Vietnamese string first
 * and an English translation second. No developer jargon: the audience is a
 * non-technical CEO.
 *
 * Commission and payout figures live in `affiliate-commission-structure.ts`;
 * this module keeps the narrative sections and page copy, and re-exports the
 * figures so callers have one import path.
 */

export {
  AFFILIATE_COMMISSION_TIERS,
  AFFILIATE_PAYOUT_RULES,
  type AffiliateCommissionTier,
  type BilingualText,
} from './affiliate-commission-structure';

/** One bilingual bullet inside a terms section. */
export interface AffiliateTermsBullet {
  vi: string;
  en: string;
}

/** A titled group of terms bullets. */
export interface AffiliateTermsSection {
  id: string;
  title: { vi: string; en: string };
  bullets: readonly AffiliateTermsBullet[];
}

/** Full terms body, in reading order. */
export const AFFILIATE_TERMS_SECTIONS: readonly AffiliateTermsSection[] = [
  {
    id: 'commission',
    title: {
      vi: '1. Hoa hồng bạn nhận được',
      en: '1. Commission you earn',
    },
    bullets: [
      {
        vi: 'Bạn nhận hoa hồng trên mỗi khóa đăng ký trả phí bắt đầu từ liên kết của bạn.',
        en: 'You earn commission on every paid subscription that starts from your link.',
      },
      {
        vi: 'Hoa hồng được tính theo giá gốc khách trả, trước thuế và trước mọi mã giảm giá.',
        en: 'Commission is calculated on the full price the customer pays, before tax and before any discount code.',
      },
      {
        vi: 'Với gói đóng phí theo tháng, bạn nhận hoa hồng trong 12 tháng nếu khách tiếp tục ở lại.',
        en: 'For monthly plans you keep earning for 12 months while the customer stays subscribed.',
      },
      {
        vi: 'Với gói trả một lần (MASTER), bạn nhận hoa hồng chỉ một lần cho mỗi khách.',
        en: 'For the one-time plan (MASTER) you are paid once per customer.',
      },
    ],
  },
  {
    id: 'attribution',
    title: {
      vi: '2. Cách ghi nhận giới thiệu',
      en: '2. How referrals are tracked',
    },
    bullets: [
      {
        vi: 'Liên kết của bạn lưu một cookie trong 30 ngày để biết khách đến từ bạn.',
        en: 'Your link stores a cookie for 30 days so we know the customer came from you.',
      },
      {
        vi: 'Khi một khách nhấp nhiều liên kết đối tác, liên kết cuối cùng trước khi đăng ký là liên kết được tính.',
        en: 'When a customer clicks several partner links, the last link before signup is the one credited.',
      },
      {
        vi: 'Chỉ có một tầng hoa hồng. Bạn không được trả thêm khi giới thiệu một đối tác khác.',
        en: 'There is only one commission level. You are not paid extra for introducing another partner.',
      },
      {
        vi: 'Cookie theo dõi thuộc nhóm "chức năng và đo lường" và chỉ chạy sau khi bạn đồng ý trên biểu ngữ cookie.',
        en: 'Tracking cookies belong to the "functional and measurement" group and only run after you accept the cookie banner.',
      },
    ],
  },
  {
    id: 'anti-fraud',
    title: {
      vi: '3. Quy tắc chống gian lận',
      en: '3. Anti-fraud rules',
    },
    bullets: [
      {
        vi: 'Tự giới thiệu chính mình, thành viên gia đình, hoặc tài khoản cùng một người điều khiển là bị cấm.',
        en: 'Self-referral is prohibited — including yourself, household members, and accounts you control.',
      },
      {
        vi: 'Không được dùng quảng cáo thương hiệu, tên miền có chữ "sophia", hoặc từ khóa thương hiệu để bắt khách tìm kiếm.',
        en: 'You may not bid on branded search terms, use domains containing "sophia", or run brand advertisements.',
      },
      {
        vi: 'Không được gửi thư rác, tin nhắn hàng loạt chưa xin phép, hoặc quảng cáo lừa đảo với liên kết của bạn.',
        en: 'You may not send spam, unsolicited bulk messages, or deceptive advertising with your link.',
      },
      {
        vi: 'Tài khoản giả, thẻ thử, hoặc đăng ký chỉ nhằm lấy hoa hồng sẽ bị hủy và không được trả tiền.',
        en: 'Fake signups, card testing, or accounts created only to trigger commission are voided and unpaid.',
      },
      {
        vi: 'Không được hứa khoản thu nhập, kết quả, hoặc mức lợi nhuận nào mà sản phẩm không đảm bảo.',
        en: 'You may not promise income, results, or profit levels the product does not guarantee.',
      },
      {
        vi: 'Nội dung quảng cáo của bạn phải công khai việc bạn nhận hoa hồng từ chúng tôi.',
        en: 'Your promotional content must openly disclose that you are paid a commission by us.',
      },
    ],
  },
  {
    id: 'clawback',
    title: {
      vi: '4. Thu hồi hoa hồng',
      en: '4. Clawback of commission',
    },
    bullets: [
      {
        vi: 'Nếu khách được hoàn tiền trong 14 ngày giữ tiền, hoa hồng tương ứng bị trừ.',
        en: 'If the customer is refunded within the 14-day hold, the matching commission is deducted.',
      },
      {
        vi: 'Nếu khách giao dịch bị đảo ngược (chargeback), toàn bộ hoa hồng của đơn đó bị thu hồi.',
        en: 'If a payment is charged back, all commission from that order is reclaimed.',
      },
      {
        vi: 'Khoản thu hồi có thể trừ vào phần chưa thanh toán hoặc phải hoàn lại nếu đã nhận.',
        en: 'A clawback is taken from unpaid balance, or repaid by you if already paid out.',
      },
      {
        vi: 'Đơn bị phát hiện gian lận không được bồi thường hoa hồng.',
        en: 'Fraudulent orders receive no commission replacement.',
      },
    ],
  },
  {
    id: 'termination',
    title: {
      vi: '5. Chấm dứt và thay đổi điều khoản',
      en: '5. Termination and changes to these terms',
    },
    bullets: [
      {
        vi: 'Bạn có thể ngừng tham gia bất cứ lúc nào bằng cách báo cho chúng tôi qua bộ phận hỗ trợ.',
        en: 'You may stop participating at any time by telling our support team.',
      },
      {
        vi: 'Chúng tôi có thể tạm dừng hoặc kết thúc tài khoản đối tác nếu vi phạm quy tắc chống gian lận.',
        en: 'We may suspend or close a partner account that breaks the anti-fraud rules.',
      },
      {
        vi: 'Sau khi chấm dứt, hoa hồng đã ở trạng thái hợp lệ vẫn được thanh toán theo đúng kỳ NET-30.',
        en: 'After termination, commission already earned and valid is still paid on the normal NET-30 schedule.',
      },
      {
        vi: 'Chúng tôi thông báo thay đổi điều khoản trước 30 ngày bằng email.',
        en: 'We announce changes to these terms 30 days in advance by email.',
      },
      {
        vi: 'Tiếp tục dùng liên kết sau ngày thay đổi có hiệu lực nghĩa là bạn chấp nhận điều khoản mới.',
        en: 'Continuing to use your link after the effective date means you accept the new terms.',
      },
    ],
  },
] as const;

/** Page-level intro copy. */
export const AFFILIATE_TERMS_INTRO = {
  vi: 'Trang này giải thích cách hoa hồng đối tác hoạt động — bạn nhận bao nhiêu, khi nào nhận, và những điều bị cấm. Viết bằng tiếng Việt trước, tiếng Anh sau.',
  en: 'This page explains how partner commission works — what you earn, when you are paid, and what is not allowed. Vietnamese is the primary language, with English below.',
} as const;
