import { Metadata } from "next";
import { GuideCommandCard } from "@/forest/components/guide/guide-command-card";
import { GuideCallout } from "@/forest/components/guide/guide-callout";

export const metadata: Metadata = {
  title: "Lệnh Telegram Bot — Hướng Dẫn Sophia AI Factory",
  description: "Danh sách đầy đủ các lệnh bot Telegram của Sophia",
};

const commandCategories = [
  {
    label: "Khởi Đầu",
    commands: [
      { command: "/start", description: "Khởi động bot và hiện tin nhắn chào mừng kèm hướng dẫn thiết lập.", example: "/start" },
      { command: "/help", description: "Xem toàn bộ danh sách lệnh có sẵn và cú pháp sử dụng.", example: "/help" },
      { command: "/email", description: "Liên kết tài khoản Sophia của bạn với Telegram để bot nhận biết bạn.", example: "/email ban@email.com" },
    ],
  },
  {
    label: "Chiến Dịch Video",
    commands: [
      { command: "/campaign", description: "Tạo chiến dịch video mới. Nhập chủ đề ngay sau lệnh hoặc bot sẽ hỏi từng bước.", example: "/campaign Top 5 tai nghe không dây 2024", mcuCost: "10–50" },
      { command: "/status", description: "Kiểm tra trạng thái tất cả chiến dịch đang chạy của bạn.", example: "/status" },
      { command: "/results", description: "Lấy link tải video đã hoàn thành và link YouTube (nếu đã xuất bản).", example: "/results" },
    ],
  },
  {
    label: "Quản Lý",
    commands: [
      { command: "/stop", description: "Tạm dừng chiến dịch đang chạy để tiết kiệm MCU credits.", example: "/stop" },
      { command: "/link", description: "Tạo lại liên kết xác thực nếu bạn cần đổi tài khoản Telegram.", example: "/link" },
    ],
  },
];

export default function CommandsGuidePage() {
  return (
    <div className="max-w-3xl space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          Lệnh Bot Telegram
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Bot <span className="font-mono text-cyan-400 text-sm">@Sophia_Bbot</span> giúp bạn quản lý chiến dịch ngay trên điện thoại, 24/7.
        </p>
      </div>

      <GuideCallout variant="tip" title="Bắt đầu nhanh">
        Tìm <span className="font-mono text-cyan-400 text-xs">@Sophia_Bbot</span> trên Telegram → nhấn <strong className="text-foreground">START</strong> → nhập <span className="font-mono text-cyan-400 text-xs">/email ban@email.com</span> để liên kết tài khoản.
      </GuideCallout>

      {/* Commands by category */}
      {commandCategories.map((cat) => (
        <div key={cat.label}>
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded bg-gradient-to-b from-violet-500 to-cyan-500 inline-block" />
            {cat.label}
          </h2>
          <div className="space-y-3">
            {cat.commands.map((cmd) => (
              <GuideCommandCard
                key={cmd.command}
                command={cmd.command}
                description={cmd.description}
                example={cmd.example}
                mcuCost={"mcuCost" in cmd ? cmd.mcuCost as string : undefined}
              />
            ))}
          </div>
        </div>
      ))}

      <GuideCallout variant="info" title="Về MCU Credits">
        MCU (Media Credit Unit) là đơn vị tính phí xử lý video. Chi phí tùy thuộc vào độ dài video và độ phức tạp.
        Gói Starter được 1.000 MCU/tháng, Growth được 5.000 MCU/tháng, Premium được 20.000 MCU/tháng, Master được 100.000 MCU/tháng.
      </GuideCallout>
    </div>
  );
}
