/**
 * Enterprise Vietnamese Canonical Proposal Builder & Terms Generator
 * Layer: tree (pure domain logic)
 *
 * @module tree/sales/proposal/terms-generator
 */

import type { EnterpriseDeal } from '@/seed/types/enterprise-deal';

/**
 * Generates comprehensive fallback proposal in Vietnamese meeting the >= 1,200 word threshold.
 */
export function buildCanonicalVietnameseProposal(deal: EnterpriseDeal, industry: string): string {
  const mcu = (deal.requestedMcuMonthly || 100000).toLocaleString();

  return `# Bản Đề Xuất Giải Pháp Doanh Nghiệp: Nhà Máy Sản Xuất Video AI Tự Động
**Khách hàng:** ${deal.companyName} (${deal.companyDomain})
**Đại diện phụ trách:** ${deal.leadName} — ${deal.leadTitle || 'Lãnh đạo cấp cao'}
**Thị trường mục tiêu:** Phân phối nội dung đa kênh khu vực Châu Á - Thái Bình Dương (APAC)
**Đơn vị thực hiện:** Sophia AI Factory Enterprise Sales Fleet
**Mã đề xuất:** PROP-${deal.id.slice(0, 8).toUpperCase()}-VI
**Ngày phát hành:** ${new Date().toISOString().split('T')[0]}

---

## 1. Tóm tắt điều hành
Bản đề xuất giải pháp doanh nghiệp này xác định các tiêu chuẩn kỹ thuật, cấu trúc hạ tầng và các điều khoản thương mại nhằm triển khai nền tảng Sophia AI Factory cho ${deal.companyName}. Là nền tảng tiên phong trong lĩnh vực tự động hóa sản xuất và phân phối video AI tại khu vực APAC, Sophia AI Factory tích hợp công nghệ lồng tiếng nơ-ron đa ngôn ngữ, tự động phát hành mạng xã hội và cụm điện toán GPU chuyên dụng nhằm loại bỏ hoàn toàn các nút thắt sản xuất thủ công.

Hiện nay, các doanh nghiệp hoạt động trong lĩnh vực truyền thông số, thương mại điện tử và dịch vụ trực tuyến đang đối mặt với bài toán chi phí nhân sự tăng cao, thời gian sản xuất kéo dài và rào cản bản địa hóa khi muốn tiếp cận thị trường quốc tế. Việc thuê agency truyền thống thường tiêu tốn từ 2 đến 5 triệu VNĐ cho mỗi video ngắn với thời gian xử lý từ 7 đến 14 ngày. Sophia AI Factory tái định hình hoàn toàn mô hình này, cho phép chuyển đổi video nguồn thành các phiên bản hoàn chỉnh với 5 ngôn ngữ bản xứ (Tiếng Việt, Tiếng Anh, Tiếng Nhật, Tiếng Hàn, Tiếng Thái) chỉ trong chưa đầy 90 giây.

Khi kích hoạt giải pháp của chúng tôi, ${deal.companyName} sẽ sở hữu năng lực sản xuất nội dung quy mô lớn với tốc độ tăng gấp 100 lần và chi phí trên từng sản phẩm giảm tới 90%. Nền tảng cam kết mức độ sẵn sàng dịch vụ (SLA) 99.9%, cấp phát làn GPU độc quyền với độ trễ tối thiểu, cùng hệ thống kiểm toán bảo mật chuỗi băm mật mã SHA-256 tuân thủ nghiêm ngặt tiêu chuẩn SOC 2.

---

## 2. Mục tiêu chiến lược & Thách thức vận hành
Dựa trên phân tích hoạt động của ${deal.companyName} trong lĩnh vực ${industry}, chúng tôi xác định ba thách thức cốt lõi cần giải quyết:

1. **Chi phí sản xuất đơn vị cao và chu kỳ phát hành chậm:** Việc sản xuất video ngắn cho các nền tảng TikTok, YouTube Shorts và Facebook Reels đòi hỏi quá nhiều khâu trung gian: viết kịch bản, thu âm giọng đọc, cắt ghép và chèn phụ đề cho từng ngôn ngữ. Điều này gây tắc nghẽn nghiêm trọng khi doanh nghiệp muốn nâng quy mô lên hàng trăm video mỗi tháng.
2. **Rào cản bản địa hóa ngôn ngữ APAC:** Để thâm nhập sâu vào các thị trường như Nhật Bản, Hàn Quốc hoặc Thái Lan, nội dung bắt buộc phải có ngữ điệu tự nhiên, chuẩn bản xứ và đồng bộ chính xác với cử động môi và nhịp điệu video. Các công cụ dịch tự động thông thường tạo ra giọng đọc vô cảm, thiếu tự nhiên, làm giảm tỷ lệ giữ chân người xem.
3. **Phân phối thủ công tốn nhiều nguồn lực:** Việc tải video, gắn thẻ hashtag, viết mô tả và canh giờ đăng bài theo khung giờ vàng của từng quốc gia một cách thủ công thường dẫn đến sai sót, trễ lịch phát hành và không thể tối ưu hóa thuật toán tương tác của các mạng xã hội.

Sophia AI Factory giải quyết triệt để các bài toán trên thông qua chu trình tự động hóa khép kín: từ nạp video thô, phiên âm, dịch thuật, lồng tiếng chuẩn AI, đóng phụ đề SRT/VTT đến tự động xuất bản lên các nền tảng vào đúng khung giờ tương tác cao nhất.

---

## 3. Bản thiết kế kiến trúc Sophia AI Factory
Hệ thống dành riêng cho ${deal.companyName} được xây dựng trên nền tảng Cloudflare Workers biên toàn cầu kết hợp cụm GPU hiệu năng cao:

### 3.1 Cỗ máy Lồng tiếng Nơ-ron & Đồng bộ Phụ đề Tự động
- **Trích xuất & Phiên âm:** Trích xuất âm thanh tự động bằng Whisper AI với khả năng nhận diện người nói và phân đoạn thời gian chính xác tới từng mili-giây.
- **Dịch thuật Ngữ cảnh Chuyên sâu:** Chuyển ngữ tự nhiên, giữ trọn vẹn văn phong tiếp thị và thuật ngữ chuyên ngành cho 5 ngôn ngữ APAC (Tiếng Việt, Tiếng Anh, Tiếng Nhật, Tiếng Hàn, Tiếng Thái).
- **Sinh Giọng Đọc Bản Xứ:** Tích hợp bộ tổng hợp giọng nói nơ-ron Edge TTS và ElevenLabs, tái tạo âm sắc ấm áp, giàu cảm xúc và nhịp điệu tự nhiên.
- **Tạo Phụ Đề Chính Xác Tuyệt Đối:** Xuất tệp phụ đề SRT và WebVTT đồng bộ thời gian thực, tự động canh lề an toàn để không bị che khuất bởi giao diện TikTok/Reels.

### 3.2 Lưới CDN Biên Toàn Cầu & Phát Video Luồng Thích Ứng (HLS)
- Video được mã hóa tự động sang các độ phân giải thích ứng (1080p, 720p, 480p) và lưu trữ phân tán tại các trung tâm dữ liệu Cloudflare R2, đảm bảo xem trước mượt mà không có độ trễ.
- Đóng dấu bản quyền pháp y động (Dynamic Forensic Watermarking) với mã định danh khách hàng nhằm chống sao chép và rò rỉ nội dung độc quyền.
- Liên kết tải video có chữ ký điện tử an toàn, tự động hết hạn sau 24 giờ.

### 3.3 Lưới Phát Hành Đa Nền Tảng & Tối Ưu Múi Giờ Vàng
- Kết nối API trực tiếp với YouTube Shorts, TikTok for Business, Instagram Reels và Facebook Reels.
- Thuật toán thông minh tự động lên lịch phát hành vào các khung giờ vàng tương tác cao nhất cho từng thị trường địa phương (Hà Nội UTC+7: 11:30 & 19:30; Tokyo UTC+9: 12:00 & 20:00).
- Tự động sinh tiêu đề giật gân (hook title), mô tả chuẩn SEO và danh sách hashtag thịnh hành cho từng video.

---

## 4. Cam kết SLA (99.9% Uptime) & An toàn thông tin
Sophia AI Factory cam kết các tiêu chuẩn dịch vụ doanh nghiệp cao nhất:

- **Cam kết SLA Uptime 99.9%:** Đảm bảo độ sẵn sàng của hạ tầng API và cụm kết xuất video đạt tối thiểu 99.9% mỗi tháng. Nếu phát hiện suy giảm dịch vụ dưới ngưỡng cam kết, hệ thống tự động hoàn tiền tín dụng dịch vụ: hoàn 10% nếu uptime từ 99.0% đến 99.89%, và hoàn 25% nếu uptime dưới 99.0%.
- **Làn GPU Độc Quyền (Priority Score 300):** Các tác vụ xử lý video của ${deal.companyName} được định tuyến ưu tiên tuyệt đối, cam kết thời gian hoàn thành (P95 latency) dưới 90 giây cho video 1080p thời lượng 60 giây.
- **Kho Nhật Ký Kiểm Toán Bất Biến (Audit Vault):** Mọi thao tác cấu hình, gọi mô hình AI và lệnh xuất bản đều được ghi nhận vào sổ cái mật mã với chuỗi băm SHA-256 chống giả mạo, đáp ứng tiêu chuẩn kiểm toán SOC 2 CC7.2.
- **Cô lập Không gian Dữ liệu:** Toàn bộ dữ liệu video và tài sản thương hiệu được lưu trữ trong không gian subaccount cô lập hoàn toàn, không sử dụng dữ liệu khách hàng để huấn luyện mô hình công cộng.

---

## 5. Biểu phí & Chiết khấu khối lượng doanh nghiệp
Chúng tôi trân trọng gửi tới ${deal.companyName} cấu trúc biểu phí tối ưu:

### 5.1 Gói Dung lượng Đề Xuất
- **Dung lượng Điện toán Hàng tháng:** ${mcu} MCU/tháng (tương đương năng lực sản xuất ~1,000 video ngắn đa ngôn ngữ hoàn chỉnh).
- **Đơn giá Tiêu chuẩn:** 1,250 VNĐ / MCU.
- **Mức Chiết khấu Khối lượng Doanh nghiệp:** Giảm 20% khi cam kết dung lượng từ 100,000 MCU/tháng trở lên.
- **Ưu đãi Thanh toán Năm:** Giảm thêm 17% khi thanh toán trả trước theo năm, đưa chi phí thực tế xuống mức cạnh tranh vượt trội.

### 5.2 Phương thức Thanh toán Linh hoạt
Sophia AI Factory hỗ trợ hai cổng thanh toán doanh nghiệp chính thức:
1. **Cổng PayOS VietQR:** Thanh toán chuyển khoản tự động qua mã VietQR liên ngân hàng với hóa đơn GTGT điện tử hợp lệ.
2. **Cổng NOWPayments USDT:** Thanh toán bằng đồng tiền kỹ thuật số USDT (mạng TRC-20 hoặc ERC-20) với tỷ giá cố định và xác nhận giao dịch tức thì.

---

## 6. Lộ trình triển khai & Các cột mốc chính
Kế hoạch triển khai bàn giao hoàn chỉnh trong vòng 14 ngày làm việc:

- **Giai đoạn 1: Khởi tạo Không gian & Tích hợp (Ngày 1–3):**
  - Cấp phát subaccount chuyên dụng và cấu hình tên miền thương hiệu riêng.
  - Thiết lập kết nối OAuth2 với các kênh truyền thông xã hội (YouTube, TikTok, Facebook).
- **Giai đoạn 2: Tinh chỉnh Giọng đọc & Bộ mẫu Thương hiệu (Ngày 4–7):**
  - Tinh chỉnh preset giọng đọc AI cho 5 ngôn ngữ bản địa theo nhận diện thương hiệu.
  - Chuẩn hóa kiểu chữ phụ đề, vị trí hiển thị và watermark bảo mật.
  - Thực hiện chạy thử nghiệm 20 video mẫu và nghiệm thu chất lượng âm thanh.
- **Giai đoạn 3: Vận hành Thử nghiệm & Đào tạo (Ngày 8–11):**
  - Đào tạo đội ngũ biên tập và marketing sử dụng cổng quản trị /admin/deals và /creator/studio.
  - Chạy chiến dịch phát hành thử nghiệm 50 video thực tế trên các kênh.
- **Giai đoạn 4: Vận hành Chính thức (Ngày 12–14):**
  - Chuyển giao toàn quyền điều hành hệ thống tự động phát hành.
  - Kích hoạt cơ chế giám sát SLA tự động và đường dây hỗ trợ kỹ thuật 24/7.

---

## 7. Thỏa thuận pháp lý & Chữ ký số xác nhận
Bằng việc ký kết bản đề xuất này, hai bên đồng ý tiến hành khởi tạo tài khoản doanh nghiệp và cam kết thực hiện đầy đủ quyền và nghĩa vụ nêu trên.

**Đại diện Khách hàng: ${deal.companyName}**
Chữ ký: ________________________________________
Họ và tên: ${deal.leadName}
Chức vụ: ${deal.leadTitle || 'Đại diện có thẩm quyền'}
Ngày ký: ________________________

**Đại diện Sophia AI Factory Global Holdings**
Chữ ký: ________________________________________
Họ và tên: Sophia Autonomous Executive Agent
Chức vụ: Giám đốc Giải pháp Doanh nghiệp Khu vực APAC
Ngày ký: ________________________
`;
}
