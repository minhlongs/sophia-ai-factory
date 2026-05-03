import { Metadata } from "next";
import { GuideAccordionFaq, FaqItem } from "@/forest/components/guide/guide-accordion-faq";
import { GuideCallout } from "@/forest/components/guide/guide-callout";

export const metadata: Metadata = {
  title: "Câu Hỏi Thường Gặp — Hướng Dẫn Sophia AI Factory",
  description: "Giải đáp những câu hỏi thường gặp nhất về Sophia AI Video Factory",
};

const generalFaqs: FaqItem[] = [
  {
    question: "Sophia AI Video Factory là gì?",
    answer: "Sophia là nền tảng tạo video tự động bằng trí tuệ nhân tạo (AI). Bạn chỉ cần nhập nội dung — Sophia tự viết kịch bản, tạo giọng nói AI, và tạo video với người dẫn ảo. Không cần biết làm video, không cần thiết bị quay phim.",
  },
  {
    question: "Tôi có cần biết lập trình không?",
    answer: "Không. Sophia được thiết kế hoàn toàn cho người không có kiến thức kỹ thuật. Mọi thứ đều có hướng dẫn từng bước bằng tiếng Việt.",
  },
  {
    question: "Mất bao lâu để tạo một video?",
    answer: "Video ngắn (dưới 3 phút) mất khoảng 2–5 phút xử lý. Video dài hơn có thể mất 10–15 phút. Bạn sẽ được thông báo qua Telegram khi video hoàn thành.",
  },
  {
    question: "Sophia tạo video như thế nào?",
    answer: "Sophia kết hợp 3 dịch vụ AI: OpenRouter viết kịch bản, ElevenLabs chuyển kịch bản thành giọng nói tự nhiên, và D-ID tạo video với người dẫn ảo AI. Tất cả diễn ra tự động sau khi bạn nhập nội dung.",
  },
];

const paymentFaqs: FaqItem[] = [
  {
    question: "Có gói dùng thử miễn phí không?",
    answer: "Các dịch vụ API (OpenRouter, ElevenLabs, D-ID) đều có gói miễn phí để bắt đầu. Tuy nhiên gói Sophia cần đăng ký trả phí để sử dụng đầy đủ tính năng.",
  },
  {
    question: "Tôi có thể tạo bao nhiêu video mỗi tháng?",
    answer: "Tùy gói: Starter (10 chiến dịch/tháng), Growth (50 chiến dịch/tháng), Premium (không giới hạn), Master (không giới hạn, trọn đời). Nếu hết hạn mức, bạn có thể nâng cấp gói bất kỳ lúc nào.",
  },
  {
    question: "Hóa đơn được gửi như thế nào?",
    answer: "Hóa đơn tự động gửi về email sau mỗi lần thanh toán. Bạn cũng có thể tải về từ Dashboard → Cài Đặt → Lịch Sử Thanh Toán.",
  },
  {
    question: "Tôi có thể hủy đăng ký không?",
    answer: "Có. Bạn có thể hủy bất kỳ lúc nào từ Dashboard → Cài Đặt → Quản Lý Gói. Tài khoản vẫn hoạt động đến hết chu kỳ thanh toán hiện tại.",
  },
  {
    question: "Làm sao để nâng cấp hoặc hạ cấp gói?",
    answer: "Vào Dashboard → Bảng Giá → chọn gói mới → thanh toán. Gói mới sẽ được kích hoạt ngay lập tức. Gói cũ sẽ hết hiệu lực khi chu kỳ hiện tại kết thúc.",
  },
];

const technicalFaqs: FaqItem[] = [
  {
    question: "API Key có an toàn không?",
    answer: "Có. API Keys được mã hóa theo chuẩn AES-256 trước khi lưu vào database. Chúng tôi không chia sẻ key của bạn với bất kỳ bên thứ ba nào.",
  },
  {
    question: "Chiến dịch bị kẹt ở trạng thái 'Đang xử lý'?",
    answer: "Đợi thêm 10 phút rồi làm mới trang Dashboard. Nếu vẫn còn sau 15 phút, nhấn nút 'Chạy Lại' (Retry) bên cạnh chiến dịch. Nếu vẫn không được, liên hệ hỗ trợ qua Telegram @Sophia_Bbot.",
  },
  {
    question: "Bot Telegram không trả lời?",
    answer: "Kiểm tra đúng tên bot: @Sophia_Bbot (chữ B viết hoa). Đảm bảo bạn đã nhấn START trước đó. Thử gửi lại lệnh /help và đợi 30 giây. Nếu vẫn không phản hồi, liên hệ support@agencyos.network.",
  },
  {
    question: "Thanh toán bị lỗi hoặc không được ghi nhận?",
    answer: "Kiểm tra: 1) Ví USDT có đủ số dư. 2) Giao dịch đã xác nhận trên blockchain (thường 2-5 phút). 3) Nếu sau 30 phút vẫn chưa kích hoạt, liên hệ @Sophia_Bbot với mã giao dịch. Hệ thống tự động kiểm tra IPN từ NOWPayments mỗi vài phút.",
  },
  {
    question: "Video xuất ra bị mất tiếng hoặc không có avatar?",
    answer: "Nguyên nhân thường gặp: API key ElevenLabs (giọng nói) hoặc D-ID (avatar) đã hết hạn hoặc hết quota miễn phí. Vào Cài Đặt → API Keys để kiểm tra. Nếu key còn hạn, thử nhấn 'Chạy Lại' trên chiến dịch.",
  },
];

const dateFaqs: FaqItem[] = [
  {
    question: "Tôi có sở hữu video do Sophia tạo không?",
    answer: "Có. Bạn sở hữu 100% nội dung. Video được xuất bản trực tiếp lên kênh YouTube/TikTok của bạn. Sophia không giữ quyền sở hữu nội dung nào.",
  },
  {
    question: "Sophia lưu dữ liệu gì của tôi?",
    answer: "Chúng tôi chỉ lưu: email, gói đăng ký, cài đặt chiến dịch, và API Keys (đã mã hóa). Chúng tôi KHÔNG lưu: video, kịch bản, giọng nói, hay bất kỳ nội dung nào bạn tạo ra.",
  },
];

export default function FAQGuidePage() {
  return (
    <div className="max-w-3xl space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Câu Hỏi Thường Gặp
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Giải đáp nhanh những thắc mắc phổ biến nhất về Sophia AI Factory.
        </p>
      </div>

      {/* General */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded bg-gradient-to-b from-violet-500 to-cyan-500 inline-block" />
          Tổng Quan
        </h2>
        <GuideAccordionFaq items={generalFaqs} />
      </div>

      {/* Payment */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded bg-gradient-to-b from-violet-500 to-cyan-500 inline-block" />
          Thanh Toán & Gói Dịch Vụ
        </h2>
        <GuideAccordionFaq items={paymentFaqs} />
      </div>

      {/* Technical */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded bg-gradient-to-b from-violet-500 to-cyan-500 inline-block" />
          Kỹ Thuật & Xử Lý Sự Cố
        </h2>
        <GuideAccordionFaq items={technicalFaqs} />
      </div>

      {/* Data */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
          <span className="w-1 h-5 rounded bg-gradient-to-b from-violet-500 to-cyan-500 inline-block" />
          Quyền Sở Hữu & Dữ Liệu
        </h2>
        <GuideAccordionFaq items={dateFaqs} />
      </div>

      <GuideCallout variant="info" title="Không tìm thấy câu trả lời?">
        Liên hệ hỗ trợ qua Telegram{" "}
        <strong className="text-foreground">@Sophia_Bbot</strong> hoặc email{" "}
        <strong className="text-foreground">support@agencyos.network</strong>.
        Gói Growth và Premium được hỗ trợ ưu tiên. Gói Master hỗ trợ VIP 24/7.
      </GuideCallout>
    </div>
  );
}
