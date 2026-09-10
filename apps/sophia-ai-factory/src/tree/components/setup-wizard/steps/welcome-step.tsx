"use client";

import React from 'react';
import { Rocket, Key, ShieldCheck, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const highlights = [
    {
      icon: Key,
      title: 'Own Your Intelligence / Làm chủ AI',
      desc: 'Connect your own AI accounts. 100% data privacy and 0% markup fees. / Kết nối tài khoản AI của riêng bạn với sự bảo mật tuyệt đối.',
    },
    {
      icon: ShieldCheck,
      title: 'Bank-Grade Security / Bảo mật chuẩn ngân hàng',
      desc: 'All credentials are encrypted with AES-256 and never shared. / Khóa API được mã hóa AES-256 an toàn.',
    },
    {
      icon: Rocket,
      title: 'Autonomous Production / Tự động sản xuất',
      desc: 'Turn scripts and concepts into viral videos with one click. / Tự động hóa tạo video từ ý tưởng chỉ với 1 cú nhấp.',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <Clock className="w-3.5 h-3.5" />
          ~5 Minutes Setup / Thiết lập trong ~5 phút
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          Welcome to Sophia AI Factory / Chào mừng đến với Sophia
        </h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Your autonomous video empire platform for non-technical CEOs. Let’s configure your system in a few simple steps.
          <br />
          Nền tảng vận hành đế chế video AI tự động dành cho nhà lãnh đạo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {highlights.map((h, i) => (
          <div key={i} className="p-4 rounded-xl border border-border bg-card space-y-2 text-left">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <h.icon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{h.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{h.desc}</p>
          </div>
        ))}
      </div>

      {/* What You Need vs Optional */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2 text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            What You Need / Bạn cần chuẩn bị:
          </span>
          <ul className="space-y-1.5 text-muted-foreground pl-5 list-disc">
            <li>OpenRouter or Anthropic key (for script creation)</li>
            <li>ElevenLabs key (for natural voiceover)</li>
            <li>d-id or fal.ai key (for image & video creation)</li>
          </ul>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2 text-xs">
          <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Optional Providers / Tùy chọn nâng cao:
          </span>
          <ul className="space-y-1.5 text-muted-foreground pl-5 list-disc">
            <li>HeyGen API key (for avatar synthesis)</li>
            <li>Resend key (for custom domain email alerts)</li>
            <li>NOWPayments key (for crypto payment processing)</li>
          </ul>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onNext}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-sm"
        >
          Bắt đầu thiết lập / Get Started
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
