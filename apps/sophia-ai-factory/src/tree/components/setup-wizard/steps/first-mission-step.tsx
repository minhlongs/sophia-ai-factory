"use client";

import React from 'react';
import { Compass, HelpCircle, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';

interface FirstMissionStepProps {
  onNext: () => void;
  onBack: () => void;
  saveError?: string | null;
  isSaving?: boolean;
}

export function FirstMissionStep({
  onNext,
  onBack,
  saveError,
  isSaving,
}: FirstMissionStepProps) {
  const blueprints = [
    {
      q: '1. WHAT DO I ENTER? / Tôi cần nhập gì?',
      a: 'Paste a product link, blog URL, or 1-line concept. Sophia handles viral hooks. / Dán link sản phẩm, bài viết, hoặc 1 câu ý tưởng. Sophia sẽ tự sáng tạo kịch bản thu hút.',
    },
    {
      q: '2. WHAT WILL SOPHIA DO? / Sophia sẽ làm gì?',
      a: 'Generates scripts, synthesizes voiceover, renders AI visuals, adds captions & produces MP4. / Tự viết kịch bản, lồng tiếng AI, dựng cảnh hình ảnh, tạo phụ đề động và xuất MP4.',
    },
    {
      q: '3. HOW LONG WILL IT TAKE? / Mất bao lâu?',
      a: '60 to 90 seconds from click to finished campaign video ready to launch. / Khoảng 60 đến 90 giây để hoàn thiện một video chất lượng cao.',
    },
    {
      q: '4. WHAT WILL IT COST? / Chi phí bao nhiêu?',
      a: '~$0.03 direct provider compute (0% markup) + 40 MCU from your monthly plan. / ~$0.03 chi phí AI gốc từ tài khoản của bạn (0% chênh lệch) + 40 MCU từ gói dịch vụ.',
    },
    {
      q: '5. WHERE WILL RESULT APPEAR? / Kết quả ở đâu?',
      a: 'Directly in your Mission Dashboard with instant preview, download & Telegram alerts. / Hiển thị ngay tại Bảng điều khiển Chiến dịch với bản xem trước và thông báo Telegram.',
    },
  ];

  const quickConcepts = [
    'Tech Gadget Review / Đánh giá sản phẩm công nghệ',
    'Financial Freedom Tips / Mẹo tài chính cá nhân',
    'SaaS Tool Explainer / Giới thiệu giải pháp phần mềm',
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
          <Compass className="w-3.5 h-3.5" />
          First Campaign Blueprint / Kế hoạch Video Đầu Tiên
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          How Sophia Runs Your First Mission / Quy trình khởi tạo an toàn
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Everything non-technical CEOs need to know before launching their first autonomous video.
          <br />
          Tất cả thông tin lãnh đạo cần biết trước khi khởi chạy chiến dịch video tự động đầu tiên.
        </p>
      </div>

      <div className="grid gap-2.5">
        {blueprints.map((item, idx) => (
          <div key={idx} className="p-3.5 rounded-xl border border-border bg-card/80 flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5 text-left">
              <h4 className="font-semibold text-foreground">{item.q}</h4>
              <p className="text-muted-foreground">{item.a}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2 text-left">
        <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Popular Mission Ideas / Ý tưởng chiến dịch phổ biến:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {quickConcepts.map((c, i) => (
            <span key={i} className="text-[11px] bg-background border border-border px-2.5 py-1 rounded-lg text-foreground font-medium">
              {c}
            </span>
          ))}
        </div>
      </div>

      {saveError && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive font-medium text-left">
          {saveError}
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-border">
        <button
          type="button"
          onClick={onBack}
          disabled={isSaving}
          className="text-sm text-muted-foreground hover:text-foreground font-medium px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại / Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 shadow-sm"
        >
          {isSaving ? 'Đang lưu / Saving...' : 'Tiếp tục / Continue'} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
