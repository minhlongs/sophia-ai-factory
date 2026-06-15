import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <Typography
            variant="display-small"
            className="text-primary mb-8 font-bold"
          >
            Chính Sách Bảo Mật
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
                    1. Thông tin chúng tôi thu thập
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    Khi bạn sử dụng website 84tea.com, chúng tôi có thể thu thập
                    các thông tin sau:
                  </Typography>
                  <ul className="list-disc list-inside text-on-surface-variant space-y-2 ml-4">
                    <li>Họ tên, email, số điện thoại khi đặt hàng</li>
                    <li>Địa chỉ giao hàng</li>
                    <li>Lịch sử đơn hàng và giao dịch</li>
                    <li>Thông tin trình duyệt và thiết bị (cookies)</li>
                  </ul>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    2. Mục đích sử dụng thông tin
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    Chúng tôi sử dụng thông tin của bạn để:
                  </Typography>
                  <ul className="list-disc list-inside text-on-surface-variant space-y-2 ml-4">
                    <li>Xử lý và giao đơn hàng</li>
                    <li>Liên hệ về tình trạng đơn hàng</li>
                    <li>Gửi thông tin khuyến mãi (nếu bạn đồng ý)</li>
                    <li>Cải thiện trải nghiệm website</li>
                    <li>Hỗ trợ khách hàng</li>
                  </ul>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    3. Bảo mật thông tin
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    Chúng tôi cam kết bảo vệ thông tin cá nhân của bạn bằng các
                    biện pháp:
                  </Typography>
                  <ul className="list-disc list-inside text-on-surface-variant space-y-2 ml-4">
                    <li>Mã hóa SSL cho tất cả giao dịch</li>
                    <li>Không chia sẻ thông tin với bên thứ ba không liên quan</li>
                    <li>Lưu trữ dữ liệu trên server bảo mật</li>
                    <li>Giới hạn quyền truy cập nội bộ</li>
                  </ul>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    4. Cookies
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    Website sử dụng cookies để cải thiện trải nghiệm người dùng.
                    Bạn có thể tắt cookies trong cài đặt trình duyệt, tuy nhiên
                    một số tính năng có thể không hoạt động đúng.
                  </Typography>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    5. Quyền của bạn
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    Bạn có quyền:
                  </Typography>
                  <ul className="list-disc list-inside text-on-surface-variant space-y-2 ml-4">
                    <li>Yêu cầu xem thông tin cá nhân chúng tôi lưu trữ</li>
                    <li>Yêu cầu chỉnh sửa thông tin không chính xác</li>
                    <li>Yêu cầu xóa dữ liệu cá nhân</li>
                    <li>Hủy đăng ký nhận email marketing</li>
                  </ul>
                </section>

                <section>
                  <Typography
                    variant="headline-small"
                    className="text-primary mb-4 font-bold"
                  >
                    6. Liên hệ
                  </Typography>
                  <Typography
                    variant="body-large"
                    className="text-on-surface-variant mb-4"
                  >
                    Nếu có thắc mắc về chính sách bảo mật, vui lòng liên hệ:
                  </Typography>
                  <div className="bg-surface-variant/30 p-4 rounded-lg border border-outline-variant/50">
                    <Typography
                      variant="body-large"
                      className="text-on-surface font-medium"
                    >
                      Email: privacy@84tea.com
                    </Typography>
                    <Typography
                      variant="body-large"
                      className="text-on-surface font-medium"
                    >
                      Hotline: 0988 030 204
                    </Typography>
                  </div>
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
