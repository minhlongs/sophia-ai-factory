"use client";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function FranchiseForm() {
  return (
    <section id="register-form" className="py-24 bg-surface">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto bg-surface border border-outline-variant rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row">
          {/* Info Side */}
          <div className="md:w-2/5 bg-primary text-on-primary p-12 flex flex-col justify-between">
            <div>
              <Typography variant="headline-medium" className="font-display mb-6">
                Liên hệ hợp tác
              </Typography>
              <Typography variant="body-medium" className="mb-8 text-on-primary">
                Để lại thông tin để được tư vấn chi tiết về chính sách nhượng quyền và các ưu đãi mới nhất.
              </Typography>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-rounded text-secondary-container text-2xl">phone_in_talk</span>
                  <div>
                    <Typography variant="title-small" className="font-bold block mb-1">Hotline</Typography>
                    <Typography variant="body-medium">+84 988 030 204</Typography>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="material-symbols-rounded text-secondary-container text-2xl">mail</span>
                  <div>
                    <Typography variant="title-small" className="font-bold block mb-1">Email</Typography>
                    <Typography variant="body-medium">franchise@84tea.vn</Typography>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="material-symbols-rounded text-secondary-container text-2xl">location_on</span>
                  <div>
                    <Typography variant="title-small" className="font-bold block mb-1">Văn phòng</Typography>
                    <Typography variant="body-medium">Tầng 1, Tòa nhà 84tea, Hà Nội, Việt Nam</Typography>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12">
               <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mb-4">
                 <span className="material-symbols-rounded text-3xl text-on-secondary-container">chat</span>
               </div>
               <Typography variant="body-small" className="italic text-on-primary">
                 &quot;Thành công của bạn là sứ mệnh của chúng tôi.&quot;
               </Typography>
            </div>
          </div>

          {/* Form Side */}
          <div className="md:w-3/5 p-12 bg-surface">
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Họ và tên *</Label>
                  <Input
                    type="text"
                    id="name"
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Số điện thoại *</Label>
                  <Input
                    type="tel"
                    id="phone"
                    placeholder="0912 xxx xxx"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  type="email"
                  id="email"
                  placeholder="example@gmail.com"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="area">Khu vực dự định</Label>
                  <Select id="area" defaultValue="">
                    <option value="" disabled>Chọn khu vực</option>
                    <option value="hanoi">Hà Nội</option>
                    <option value="hcm">TP. Hồ Chí Minh</option>
                    <option value="danang">Đà Nẵng</option>
                    <option value="other">Khác</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget">Ngân sách dự kiến</Label>
                  <Select id="budget" defaultValue="">
                    <option value="" disabled>Chọn mức ngân sách</option>
                    <option value="under-500">Dưới 500 triệu</option>
                    <option value="500-1b">500 triệu - 1 tỷ</option>
                    <option value="over-1b">Trên 1 tỷ</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mô hình quan tâm</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer p-3 border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors">
                    <input type="radio" name="model" value="kiosk" className="text-primary focus:ring-primary accent-primary w-4 h-4" />
                    <span className="text-on-surface text-sm font-medium">Kiosk</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-3 border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors">
                    <input type="radio" name="model" value="express" className="text-primary focus:ring-primary accent-primary w-4 h-4" />
                    <span className="text-on-surface text-sm font-medium">Express</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-3 border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors">
                    <input type="radio" name="model" value="lounge" className="text-primary focus:ring-primary accent-primary w-4 h-4" />
                    <span className="text-on-surface text-sm font-medium">Lounge</span>
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" variant="filled" size="lg" className="w-full bg-secondary text-on-secondary hover:bg-secondary/90">
                  Gửi đăng ký tư vấn
                </Button>
                <p className="text-xs text-on-surface-variant text-center mt-3">
                  Bằng việc gửi thông tin, bạn đồng ý với chính sách bảo mật của 84tea.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
