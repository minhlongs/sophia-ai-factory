import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <Typography
            variant="display-small"
            className="text-primary mb-8 font-bold"
          >
            Chính Sách Đổi Trả & Hoàn Tiền
          </Typography>

          <Card className="shadow-lg border-none bg-surface-container-low">
            <CardContent className="p-8">
              {/* Highlight */}
              <div className="bg-primary-container/30 border border-primary-container rounded-xl p-6 mb-8 flex items-center gap-4">
                <span className="text-4xl">↩️</span>
                <div>
                  <Typography
                    variant="title-medium"
                    className="text-primary font-bold"
                  >
                    Đổi trả miễn phí trong 7 ngày
                  </Typography>
                  <Typography
                    variant="body-medium"
                    className="text-on-surface-variant"
                  >
                    Áp dụng cho sản phẩm còn nguyên seal, chưa sử dụng
                  </Typography>
                </div>
              </div>

              <Typography
                variant="headline-small"
                className="text-primary mt-8 mb-4 font-bold"
              >
                Điều kiện đổi trả
              </Typography>
              <ul className="list-disc list-inside text-on-surface-variant mb-4 space-y-2 ml-4">
                <li>Sản phẩm còn nguyên seal, chưa bóc</li>
                <li>Còn nguyên bao bì, không móp méo</li>
                <li>Có hóa đơn hoặc mã đơn hàng</li>
                <li>Yêu cầu đổi trả trong vòng 7 ngày từ ngày nhận hàng</li>
              </ul>

              <Typography
                variant="headline-small"
                className="text-primary mt-8 mb-4 font-bold"
              >
                Trường hợp được đổi trả
              </Typography>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-primary-container/20 rounded-xl p-4 border border-primary-container/50">
                  <Typography
                    variant="title-small"
                    className="text-primary font-bold mb-2"
                  >
                    ✓ Được đổi
                  </Typography>
                  <ul className="text-sm text-on-surface-variant space-y-1">
                    <li>• Sản phẩm bị lỗi từ nhà sản xuất</li>
                    <li>• Giao sai sản phẩm</li>
                    <li>• Sản phẩm hư hỏng trong quá trình vận chuyển</li>
                    <li>• Đổi size/loại sản phẩm (còn seal)</li>
                  </ul>
                </div>
                <div className="bg-error-container/20 rounded-xl p-4 border border-error-container/50">
                  <Typography
                    variant="title-small"
                    className="text-error font-bold mb-2"
                  >
                    ✗ Không đổi
                  </Typography>
                  <ul className="text-sm text-on-surface-variant space-y-1">
                    <li>• Đã mở seal, sử dụng</li>
                    <li>• Không còn nguyên bao bì</li>
                    <li>• Quá 7 ngày từ ngày nhận</li>
                    <li>• Hư hỏng do người dùng</li>
                  </ul>
                </div>
              </div>

              <Typography
                variant="headline-small"
                className="text-primary mt-8 mb-4 font-bold"
              >
                Quy trình đổi trả
              </Typography>
              <div className="space-y-4 mb-6">
                {[
                  {
                    title: "Liên hệ CSKH",
                    desc: "Gọi hotline 0988 030 204 hoặc email support@84tea.com",
                  },
                  {
                    title: "Gửi sản phẩm",
                    desc: "Đóng gói cẩn thận và gửi về địa chỉ được cung cấp",
                  },
                  {
                    title: "Xử lý yêu cầu",
                    desc: "Chúng tôi kiểm tra và xử lý trong 2-3 ngày làm việc",
                  },
                  {
                    title: "Đổi hàng / Hoàn tiền",
                    desc: "Gửi sản phẩm mới hoặc hoàn tiền qua chuyển khoản",
                  },
                ].map((step, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0 font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <Typography
                        variant="title-medium"
                        className="text-on-surface font-bold"
                      >
                        {step.title}
                      </Typography>
                      <Typography
                        variant="body-medium"
                        className="text-on-surface-variant"
                      >
                        {step.desc}
                      </Typography>
                    </div>
                  </div>
                ))}
              </div>

              <Typography
                variant="headline-small"
                className="text-primary mt-8 mb-4 font-bold"
              >
                Hoàn tiền
              </Typography>
              <Typography
                variant="body-large"
                className="text-on-surface-variant mb-4"
              >
                Tiền sẽ được hoàn qua chuyển khoản ngân hàng trong 5-7 ngày làm
                việc kể từ khi yêu cầu được duyệt.
              </Typography>

              <div className="bg-secondary-container/30 rounded-xl p-6 mt-8 border border-secondary-container/50">
                <Typography
                  variant="title-medium"
                  className="text-on-surface font-bold mb-2"
                >
                  Hotline đổi trả
                </Typography>
                <Typography
                  variant="body-medium"
                  className="text-on-surface-variant"
                >
                  <strong>0988 030 204</strong> (8:00 - 21:00 hàng ngày)
                  <br />
                  Email: support@84tea.com
                </Typography>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
