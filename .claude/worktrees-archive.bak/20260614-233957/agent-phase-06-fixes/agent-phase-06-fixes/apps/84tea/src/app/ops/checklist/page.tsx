"use client";

import { useState } from "react";
import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

const morningChecklist: ChecklistItem[] = [
  { id: "m1", label: "Mở cửa, bật đèn và điều hòa", checked: false },
  { id: "m2", label: "Kiểm tra tiền quỹ đầu ngày", checked: false },
  { id: "m3", label: "Bật máy pha trà, kiểm tra nước", checked: false },
  { id: "m4", label: "Kiểm tra bộ lọc nước", checked: false },
  { id: "m5", label: "Chuẩn bị nguyên liệu (trà, đường, chanh...)", checked: false },
  { id: "m6", label: "Vệ sinh khu vực phục vụ", checked: false },
  { id: "m7", label: "Đăng nhập hệ thống POS", checked: false },
  { id: "m8", label: "Kiểm tra và xử lý đơn online", checked: false },
  { id: "m9", label: "Kiểm tra teaware (ấm, chén, khay)", checked: false },
  { id: "m10", label: "Đeo đồng phục, name tag", checked: false },
];

const eveningChecklist: ChecklistItem[] = [
  { id: "e1", label: "Dọn dẹp, vệ sinh bàn ghế", checked: false },
  { id: "e2", label: "Rửa và cất teaware", checked: false },
  { id: "e3", label: "Kiểm tra nguyên liệu tồn kho", checked: false },
  { id: "e4", label: "Ghi chú nguyên liệu cần đặt", checked: false },
  { id: "e5", label: "Đếm tiền, đối chiếu với POS", checked: false },
  { id: "e6", label: "Ghi báo cáo doanh số ngày", checked: false },
  { id: "e7", label: "Lau dọn sàn nhà", checked: false },
  { id: "e8", label: "Tắt máy pha trà, điều hòa", checked: false },
  { id: "e9", label: "Kiểm tra cửa sổ, cửa phụ", checked: false },
  { id: "e10", label: "Khóa cửa chính, bật camera", checked: false },
];

export default function ChecklistPage() {
  const [morning, setMorning] = useState(morningChecklist);
  const [evening, setEvening] = useState(eveningChecklist);
  const [date] = useState(new Date().toLocaleDateString("vi-VN"));

  const toggleMorning = (id: string) => {
    setMorning((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const toggleEvening = (id: string) => {
    setEvening((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const morningProgress = morning.filter((i) => i.checked).length;
  const eveningProgress = evening.filter((i) => i.checked).length;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-8">
            <Typography variant="display-small" className="font-display text-on-surface mb-2">
              Checklist Vận Hành Hàng Ngày
            </Typography>
            <Typography variant="body-large" className="text-on-surface-variant">
              📅 {date}
            </Typography>
          </div>

          {/* Morning Checklist */}
          <Card className="mb-8 border-none shadow-sm bg-surface-container-low">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🌅</span>
                  <div>
                    <Typography variant="headline-small" className="font-display text-primary">
                      Mở cửa (8:00 - 9:00)
                    </Typography>
                    <Typography variant="body-medium" className="text-on-surface-variant">
                      {morningProgress}/{morning.length} hoàn thành
                    </Typography>
                  </div>
                </div>
                <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center">
                  <span className="text-xl font-bold text-on-primary-container">
                    {Math.round((morningProgress / morning.length) * 100)}%
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {morning.map((item, index) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-colors border ${
                      item.checked
                        ? "bg-primary-container border-primary"
                        : "bg-surface border-transparent hover:bg-surface-container"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleMorning(item.id)}
                      className="w-5 h-5 accent-primary cursor-pointer"
                    />
                    <span className="text-on-surface-variant/60 font-mono text-sm">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Typography
                      variant="body-medium"
                      className={`flex-1 ${
                        item.checked
                          ? "text-primary font-medium line-through decoration-primary/50"
                          : "text-on-surface"
                      }`}
                    >
                      {item.label}
                    </Typography>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Evening Checklist */}
          <Card className="mb-8 border-none shadow-sm bg-surface-container-low">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🌙</span>
                  <div>
                    <Typography variant="headline-small" className="font-display text-primary">
                      Đóng cửa (21:00 - 22:00)
                    </Typography>
                    <Typography variant="body-medium" className="text-on-surface-variant">
                      {eveningProgress}/{evening.length} hoàn thành
                    </Typography>
                  </div>
                </div>
                <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center">
                  <span className="text-xl font-bold text-on-primary-container">
                    {Math.round((eveningProgress / evening.length) * 100)}%
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {evening.map((item, index) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-colors border ${
                      item.checked
                        ? "bg-primary-container border-primary"
                        : "bg-surface border-transparent hover:bg-surface-container"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleEvening(item.id)}
                      className="w-5 h-5 accent-primary cursor-pointer"
                    />
                    <span className="text-on-surface-variant/60 font-mono text-sm">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Typography
                      variant="body-medium"
                      className={`flex-1 ${
                        item.checked
                          ? "text-primary font-medium line-through decoration-primary/50"
                          : "text-on-surface"
                      }`}
                    >
                      {item.label}
                    </Typography>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Button
              onClick={() => setMorning(morningChecklist)}
              variant="outlined"
              size="lg"
              className="rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-on-primary"
            >
              Reset buổi sáng
            </Button>
            <Button
              onClick={() => setEvening(eveningChecklist)}
              variant="outlined"
              size="lg"
              className="rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-on-primary"
            >
              Reset buổi tối
            </Button>
          </div>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
