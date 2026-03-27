import { Metadata } from "next";
import { GuideStepCard } from "@/components/guide/guide-step-card";
import { GuideCodeBlock } from "@/components/guide/guide-code-block";
import { GuideCallout } from "@/components/guide/guide-callout";

export const metadata: Metadata = {
  title: "Telegram Bot — Hướng Dẫn Sophia AI Factory",
  description: "Cách sử dụng bot @Sophia_Bbot trên Telegram để tạo video",
};

const botCommands = `/start        — Tin nhắn chào mừng
/email        — Liên kết tài khoản Sophia
/campaign     — Tạo chiến dịch video mới
/status       — Kiểm tra chiến dịch đang chạy
/results      — Lấy link video đã hoàn thành
/stop         — Tạm dừng chiến dịch
/help         — Xem tất cả lệnh`;

const commandTable = [
  { cmd: "/link", desc: "Kết nối tài khoản Sophia với Telegram" },
  { cmd: "/campaign", desc: "Tạo video mới từ chủ đề bạn nhập" },
  { cmd: "/status", desc: "Xem trạng thái chiến dịch đang chạy" },
  { cmd: "/results", desc: "Nhận link video đã hoàn thành" },
  { cmd: "/stop", desc: "Tạm dừng chiến dịch đang xử lý" },
  { cmd: "/help", desc: "Danh sách tất cả lệnh" },
];

export default function TelegramGuidePage() {
  return (
    <div className="max-w-3xl space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Hướng Dẫn Telegram Bot
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Điều khiển Sophia từ điện thoại 24/7 qua bot{" "}
          <span className="font-mono text-cyan-400 text-sm">@Sophia_Bbot</span> trên Telegram.
        </p>
      </div>

      {/* Setup steps */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Thiết Lập Ban Đầu</h2>
        <div className="space-y-4">
          <GuideStepCard
            step={1}
            title="Cài Đặt Telegram"
            description="Tải ứng dụng Telegram từ App Store (iPhone) hoặc Google Play (Android). Đăng ký bằng số điện thoại nếu chưa có tài khoản."
          />
          <GuideStepCard
            step={2}
            title="Tìm Bot Sophia"
            description={
              <span>
                Mở Telegram, nhấn biểu tượng kính lúp, tìm kiếm{" "}
                <span className="font-mono text-cyan-400 text-xs">@Sophia_Bbot</span> (chú ý chữ <strong className="text-foreground">B</strong> viết hoa).
                Nhấn vào kết quả và nhấn <strong className="text-foreground">START</strong>.
              </span>
            }
            code="@Sophia_Bbot"
          />
          <GuideStepCard
            step={3}
            title="Liên Kết Tài Khoản"
            description={
              <span>
                Nhập lệnh <span className="font-mono text-cyan-400 text-xs">/email</span> kèm email bạn dùng để đăng ký Sophia.
                Bot sẽ gửi mã xác nhận 6 số về email — nhập mã đó vào Telegram.
              </span>
            }
            code="/email ban@email.com"
          />
          <GuideStepCard
            step={4}
            title="Tạo Video Đầu Tiên"
            description={
              <span>
                Nhập <span className="font-mono text-cyan-400 text-xs">/campaign</span> kèm chủ đề video.
                Bot sẽ xử lý trong 2–5 phút và thông báo khi xong. Nhập <span className="font-mono text-cyan-400 text-xs">/results</span> để lấy link.
              </span>
            }
            code="/campaign Top 5 tai nghe không dây dưới 1 triệu"
          />
        </div>
      </div>

      <GuideCallout variant="warning" title="Lưu ý tên bot">
        Tên đúng là <strong className="text-foreground">@Sophia_Bbot</strong> — chữ <strong className="text-foreground">B</strong> viết hoa.
        Tìm không ra? Vào trực tiếp: <span className="font-mono text-cyan-400 text-xs">t.me/Sophia_Bbot</span>
      </GuideCallout>

      {/* Commands reference */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Danh Sách Lệnh</h2>
        <GuideCodeBlock code={botCommands} language="telegram" />
      </div>

      {/* Command table */}
      <div className="border border-border/40 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[auto_1fr] bg-muted/30 px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 gap-6">
          <span>Lệnh</span>
          <span>Chức Năng</span>
        </div>
        {commandTable.map((row) => (
          <div
            key={row.cmd}
            className="grid grid-cols-[auto_1fr] px-5 py-3 text-sm border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors gap-6 items-center"
          >
            <span className="font-mono text-cyan-400 text-xs bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 whitespace-nowrap">
              {row.cmd}
            </span>
            <span className="text-muted-foreground">{row.desc}</span>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Mẹo Sử Dụng</h2>
        <div className="space-y-3">
          <GuideCallout variant="tip">
            Mô tả chủ đề càng cụ thể, video càng chất lượng. Thay vì <em className="text-foreground">"tai nghe"</em>, hãy viết <em className="text-foreground">"Top 5 tai nghe không dây dưới 1 triệu tốt nhất 2024"</em>.
          </GuideCallout>
          <GuideCallout variant="info">
            Bot hoạt động 24/7. Khi video xong, bot sẽ <strong className="text-foreground">tự động thông báo</strong> cho bạn — không cần ngồi chờ.
          </GuideCallout>
        </div>
      </div>

      {/* Support */}
      <div className="bg-card/50 border border-border/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Cần Hỗ Trợ?</h3>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div>Bot không phản hồi → nhập <span className="font-mono text-cyan-400 text-xs">/help</span> và đợi 30 giây</div>
          <div>Vẫn không được → Email: <span className="font-mono text-violet-400 text-xs">support@agencyos.network</span></div>
          <div>Xem thêm → <a href="/guide/faq" className="text-cyan-400 hover:underline">Câu hỏi thường gặp</a></div>
        </div>
      </div>
    </div>
  );
}
