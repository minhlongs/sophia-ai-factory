"use client";

import { useState } from "react";
import Link from "next/link";
import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";

interface FormData {
  // Step 1: Personal Info
  fullName: string;
  idNumber: string;
  birthDate: string;
  email: string;
  phone: string;
  currentAddress: string;
  // Step 2: Experience
  fbExperience: string;
  managementExperience: string;
  availableCapital: string;
  currentOccupation: string;
  // Step 3: Business Plan
  preferredLocation: string;
  city: string;
  spaceSize: string;
  expectedOpenDate: string;
  motivation: string;
  // Step 4: Confirmation
  agreedTerms: boolean;
  readyForTraining: boolean;
  confirmedInfo: boolean;
}

const initialFormData: FormData = {
  fullName: "",
  idNumber: "",
  birthDate: "",
  email: "",
  phone: "",
  currentAddress: "",
  fbExperience: "",
  managementExperience: "",
  availableCapital: "",
  currentOccupation: "",
  preferredLocation: "",
  city: "",
  spaceSize: "",
  expectedOpenDate: "",
  motivation: "",
  agreedTerms: false,
  readyForTraining: false,
  confirmedInfo: false,
};

const cities = [
  "Hà Nội",
  "TP. Hồ Chí Minh",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "Nha Trang",
  "Huế",
  "Biên Hòa",
  "Bắc Ninh",
  "Khác",
];

export default function FranchiseApplyPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // In production, send to Supabase or email
    console.log("Franchise application:", formData);

    setSubmitted(true);
    setIsSubmitting(false);
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <HeaderNavigation />
        <main className="flex-1 pt-32 pb-24 flex items-center justify-center">
          <div className="max-w-2xl mx-auto px-6 text-center w-full">
            <Card className="p-12 shadow-xl border-none bg-surface-container-low">
              <CardContent>
                <div className="w-24 h-24 mx-auto mb-6 bg-primary-container rounded-full flex items-center justify-center">
                  <span className="text-5xl text-on-primary-container">✓</span>
                </div>
                <Typography variant="headline-medium" className="font-display text-primary mb-4">
                  Đăng ký thành công!
                </Typography>
                <Typography variant="body-large" className="text-on-surface-variant mb-8">
                  Cảm ơn bạn đã quan tâm đến nhượng quyền 84tea.
                  <br />
                  Chúng tôi sẽ liên hệ bạn trong 2-3 ngày làm việc.
                </Typography>
                <Link href="/">
                  <Button variant="filled" size="lg">
                    Về trang chủ
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <FooterSection />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-3xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-8">
            <Typography variant="display-medium" className="font-display text-primary mb-4">
              Đăng Ký Nhượng Quyền
            </Typography>
            <Typography variant="body-large" className="text-on-surface-variant">
              Hoàn thành form dưới đây để bắt đầu hành trình cùng 84tea
            </Typography>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    s <= step
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-highest text-on-surface-variant"
                  }`}
                >
                  {s}
                </div>
                {s < 4 && (
                  <div
                    className={`w-12 h-1 transition-colors ${
                      s < step ? "bg-primary" : "bg-surface-container-highest"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Form */}
          <Card className="bg-surface-container-low border-none shadow-lg">
            <CardContent className="p-8">
              {/* Step 1: Personal Info */}
              {step === 1 && (
                <div className="space-y-6">
                  <Typography variant="headline-small" className="font-display text-on-surface mb-6">
                    Thông tin cá nhân
                  </Typography>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Họ và tên *</Label>
                      <Input
                        id="fullName"
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => updateField("fullName", e.target.value)}
                        placeholder="Nguyễn Văn A"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idNumber">Số CCCD *</Label>
                      <Input
                        id="idNumber"
                        type="text"
                        value={formData.idNumber}
                        onChange={(e) => updateField("idNumber", e.target.value)}
                        placeholder="012345678901"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="birthDate">Ngày sinh *</Label>
                      <Input
                        id="birthDate"
                        type="date"
                        value={formData.birthDate}
                        onChange={(e) => updateField("birthDate", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Số điện thoại *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        placeholder="0912 345 678"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentAddress">Địa chỉ hiện tại *</Label>
                    <Input
                      id="currentAddress"
                      type="text"
                      value={formData.currentAddress}
                      onChange={(e) => updateField("currentAddress", e.target.value)}
                      placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Experience */}
              {step === 2 && (
                <div className="space-y-6">
                  <Typography variant="headline-small" className="font-display text-on-surface mb-6">
                    Kinh nghiệm & Năng lực
                  </Typography>
                  <div className="space-y-2">
                    <Label htmlFor="currentOccupation">Nghề nghiệp hiện tại *</Label>
                    <Input
                      id="currentOccupation"
                      type="text"
                      value={formData.currentOccupation}
                      onChange={(e) => updateField("currentOccupation", e.target.value)}
                      placeholder="VD: Kinh doanh tự do, Nhân viên văn phòng..."
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fbExperience">Kinh nghiệm F&B</Label>
                      <Select
                        id="fbExperience"
                        value={formData.fbExperience}
                        onChange={(e) => updateField("fbExperience", e.target.value)}
                      >
                        <option value="">Chọn...</option>
                        <option value="none">Chưa có</option>
                        <option value="1-2">1-2 năm</option>
                        <option value="3-5">3-5 năm</option>
                        <option value="5+">Trên 5 năm</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="managementExperience">Kinh nghiệm quản lý</Label>
                      <Select
                        id="managementExperience"
                        value={formData.managementExperience}
                        onChange={(e) => updateField("managementExperience", e.target.value)}
                      >
                        <option value="">Chọn...</option>
                        <option value="none">Chưa có</option>
                        <option value="1-2">1-2 năm</option>
                        <option value="3-5">3-5 năm</option>
                        <option value="5+">Trên 5 năm</option>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="availableCapital">Vốn sẵn có (VND) *</Label>
                    <Select
                      id="availableCapital"
                      value={formData.availableCapital}
                      onChange={(e) => updateField("availableCapital", e.target.value)}
                    >
                      <option value="">Chọn...</option>
                      <option value="200-300">200-300 triệu</option>
                      <option value="300-400">300-400 triệu</option>
                      <option value="400-500">400-500 triệu</option>
                      <option value="500+">Trên 500 triệu</option>
                    </Select>
                  </div>
                </div>
              )}

              {/* Step 3: Business Plan */}
              {step === 3 && (
                <div className="space-y-6">
                  <Typography variant="headline-small" className="font-display text-on-surface mb-6">
                    Kế hoạch kinh doanh
                  </Typography>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Tỉnh/Thành phố dự kiến *</Label>
                      <Select
                        id="city"
                        value={formData.city}
                        onChange={(e) => updateField("city", e.target.value)}
                      >
                        <option value="">Chọn...</option>
                        {cities.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="spaceSize">Diện tích mặt bằng</Label>
                      <Select
                        id="spaceSize"
                        value={formData.spaceSize}
                        onChange={(e) => updateField("spaceSize", e.target.value)}
                      >
                        <option value="">Chọn...</option>
                        <option value="25-40">25-40m²</option>
                        <option value="40-60">40-60m²</option>
                        <option value="60-100">60-100m²</option>
                        <option value="100+">Trên 100m²</option>
                        <option value="chưa có">Chưa có mặt bằng</option>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferredLocation">Vị trí dự kiến (nếu có)</Label>
                    <Input
                      id="preferredLocation"
                      type="text"
                      value={formData.preferredLocation}
                      onChange={(e) => updateField("preferredLocation", e.target.value)}
                      placeholder="VD: Phố Cổ Hà Nội, Quận 1 HCM..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expectedOpenDate">Thời gian dự kiến mở</Label>
                    <Select
                      id="expectedOpenDate"
                      value={formData.expectedOpenDate}
                      onChange={(e) => updateField("expectedOpenDate", e.target.value)}
                    >
                      <option value="">Chọn...</option>
                      <option value="1-2">1-2 tháng tới</option>
                      <option value="3-6">3-6 tháng tới</option>
                      <option value="6-12">6-12 tháng tới</option>
                      <option value="chưa xác định">Chưa xác định</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motivation">Lý do muốn mở 84tea</Label>
                    <Textarea
                      id="motivation"
                      value={formData.motivation}
                      onChange={(e) => updateField("motivation", e.target.value)}
                      rows={4}
                      className="resize-none"
                      placeholder="Chia sẻ động lực và kỳ vọng của bạn..."
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Confirmation */}
              {step === 4 && (
                <div className="space-y-6">
                  <Typography variant="headline-small" className="font-display text-on-surface mb-6">
                    Xác nhận & Cam kết
                  </Typography>

                  <div className="bg-surface-container rounded-xl p-6 space-y-4">
                    <Typography variant="title-medium" className="font-semibold text-primary">Tóm tắt thông tin:</Typography>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-on-surface-variant">Họ tên:</span>
                        <span className="ml-2 font-medium text-on-surface">{formData.fullName || "-"}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">SĐT:</span>
                        <span className="ml-2 font-medium text-on-surface">{formData.phone || "-"}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Vốn:</span>
                        <span className="ml-2 font-medium text-on-surface">{formData.availableCapital || "-"} triệu</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Thành phố:</span>
                        <span className="ml-2 font-medium text-on-surface">{formData.city || "-"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.agreedTerms}
                        onChange={(e) => updateField("agreedTerms", e.target.checked)}
                        className="mt-1 w-5 h-5 accent-primary"
                      />
                      <span className="text-sm text-on-surface-variant">
                        Tôi đã đọc và đồng ý với{" "}
                        <Link href="/terms" className="text-primary hover:underline">
                          Điều khoản nhượng quyền
                        </Link>{" "}
                        của 84tea
                      </span>
                    </Label>
                    <Label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.readyForTraining}
                        onChange={(e) => updateField("readyForTraining", e.target.checked)}
                        className="mt-1 w-5 h-5 accent-primary"
                      />
                      <span className="text-sm text-on-surface-variant">
                        Tôi sẵn sàng tham gia khóa training 2 tuần trước khi mở cửa hàng
                      </span>
                    </Label>
                    <Label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.confirmedInfo}
                        onChange={(e) => updateField("confirmedInfo", e.target.checked)}
                        className="mt-1 w-5 h-5 accent-primary"
                      />
                      <span className="text-sm text-on-surface-variant">
                        Tôi xác nhận thông tin trên là chính xác
                      </span>
                    </Label>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t border-outline-variant">
                {step > 1 ? (
                  <Button
                    onClick={prevStep}
                    variant="outlined"
                    size="lg"
                  >
                    ← Quay lại
                  </Button>
                ) : (
                  <div />
                )}

                {step < 4 ? (
                  <Button
                    onClick={nextStep}
                    variant="filled"
                    size="lg"
                  >
                    Tiếp tục →
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !formData.agreedTerms || !formData.readyForTraining || !formData.confirmedInfo}
                    variant="filled"
                    size="lg"
                  >
                    {isSubmitting ? "Đang gửi..." : "Gửi đăng ký"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
