import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <Typography
            variant="display-small"
            className="text-primary mb-8 font-bold"
          >
            Điều Khoản Sử Dụng
          </Typography>

          <Card className="shadow-lg border-none bg-surface-container-low">
            <CardContent className="p-8">
              <Typography
                variant="body-medium"
                className="text-on-surface-variant mb-6 italic"
              >
                Cập nhật lần cuối: Tháng 02, 2026
              </Typography>

              <div className="space-y-8">
                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    1. Giới thiệu
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    Chào mừng bạn đến với 84tea. Khi truy cập và sử dụng website
                    84tea.com, bạn đồng ý tuân thủ các điều khoản và điều kiện
                    được nêu trong tài liệu này.
                  </Typography>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    2. Thông tin công ty
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    <strong>3704 Co., LTD</strong>
                    <br />
                    GPKD: 011 070 44 89
                    <br />
                    Ngày thành lập: 04/05/2024
                    <br />
                    Địa chỉ: 134 Nguyễn Hoàng Tôn, Phú Thượng, Tây Hồ, Hà Nội
                  </Typography>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    3. Sản phẩm và dịch vụ
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    84tea cung cấp các sản phẩm trà cao cấp từ cây trà cổ thụ
                    Shan Tuyết Việt Nam. Tất cả sản phẩm được sản xuất theo tiêu
                    chuẩn an toàn thực phẩm và có nguồn gốc rõ ràng.
                  </Typography>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    4. Đặt hàng và thanh toán
                  </Typography>
                  <ul className="list-disc list-inside text-on-surface-variant mb-4 space-y-2 ml-4">
                    <li>Đơn hàng được xác nhận sau khi thanh toán thành công</li>
                    <li>Chúng tôi chấp nhận thanh toán qua VietQR (PayOS)</li>
                    <li>Giá sản phẩm đã bao gồm VAT</li>
                    <li>
                      Phí vận chuyển được tính riêng theo địa chỉ giao hàng
                    </li>
                  </ul>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    5. Giao hàng
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    Đơn hàng sẽ được giao trong 2-5 ngày làm việc tùy khu vực.
                    Miễn phí vận chuyển cho đơn hàng từ 500.000đ.
                  </Typography>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    6. Đổi trả và hoàn tiền
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    Khách hàng có thể đổi/trả sản phẩm trong vòng 7 ngày kể từ
                    ngày nhận hàng với điều kiện sản phẩm còn nguyên seal, chưa
                    sử dụng. Xem chi tiết tại trang Chính sách đổi trả.
                  </Typography>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    7. Quyền sở hữu trí tuệ
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    Tất cả nội dung trên website 84tea.com bao gồm logo, hình
                    ảnh, văn bản là tài sản của 3704 Co., LTD và được bảo vệ bởi
                    luật sở hữu trí tuệ.
                  </Typography>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    8. Liên hệ
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    Mọi thắc mắc vui lòng liên hệ:
                    <br />
                    Email: hello@84tea.com
                    <br />
                    Hotline: 0988 030 204
                  </Typography>
                </section>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
