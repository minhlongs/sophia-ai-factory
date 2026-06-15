"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";

export function StorySection() {
  return (
    <section className="py-24 bg-surface overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="relative order-2 md:order-1">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-surface-variant relative">
              {/* Placeholder for story image */}
              <div className="absolute inset-0 bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-rounded text-6xl">landscape</span>
              </div>
            </div>
            {/* Decorative element */}
            <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-secondary-container rounded-full -z-10 blur-3xl" />
            <div className="absolute -top-8 -left-8 w-48 h-48 bg-primary-container rounded-full -z-10 blur-3xl" />
          </div>

          <div className="order-1 md:order-2">
            <Typography variant="label-large" className="text-primary tracking-widest uppercase mb-4">
              Về 84tea
            </Typography>
            <Typography variant="headline-large" className="text-on-surface mb-6 font-display">
              Đánh thức vị giác bằng <br />
              <span className="text-primary italic">sự nguyên bản</span>
            </Typography>
            <div className="space-y-6 text-on-surface-variant">
              <Typography variant="body-large">
                84tea ra đời với sứ mệnh gìn giữ và tôn vinh những cây trà cổ thụ Việt Nam.
                Con số 84 không chỉ là mã vùng quốc gia, mà còn là lời khẳng định tự hào
                về nguồn gốc của những búp trà thượng hạng.
              </Typography>
              <Typography variant="body-large">
                Chúng tôi đi dọc dải đất hình chữ S, tìm đến những vùng núi cao hiểm trở,
                nơi đồng bào dân tộc thiểu số vẫn ngày đêm gìn giữ những rừng trà cổ thụ
                hàng trăm năm tuổi.
              </Typography>
            </div>

            <div className="mt-10 flex gap-8">
              <div>
                <Typography variant="display-medium" className="text-secondary font-display">
                  300+
                </Typography>
                <Typography variant="body-medium" className="text-on-surface-variant">
                  Tuổi đời cây trà
                </Typography>
              </div>
              <div>
                <Typography variant="display-medium" className="text-secondary font-display">
                  1300m
                </Typography>
                <Typography variant="body-medium" className="text-on-surface-variant">
                  Độ cao trung bình
                </Typography>
              </div>
              <div>
                <Typography variant="display-medium" className="text-secondary font-display">
                  100%
                </Typography>
                <Typography variant="body-medium" className="text-on-surface-variant">
                  Hữu cơ tự nhiên
                </Typography>
              </div>
            </div>

            <div className="mt-10">
              <Button variant="text" className="pl-0 text-primary hover:text-secondary transition-colors" asChild>
                <Link href="/story" className="flex items-center gap-2">
                  Xem chi tiết hành trình
                  <span className="material-symbols-rounded">arrow_forward</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
