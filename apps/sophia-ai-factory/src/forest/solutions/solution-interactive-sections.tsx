'use client';

/**
 * Interactive Client Sections for Programmatic SEO Solutions Pages.
 *
 * Includes:
 * 1. Interactive Sample Prompt Runner with 1-click copy & Telegram launch
 * 2. Real-Time ROI & Cost Savings Calculator
 * 3. Interactive FAQ Accordion
 * 4. High-Converting Bottom Conversion CTA with SOLO100 promo code
 *
 * Layer: Forest (Interactive UI component, imports seed/tree)
 *
 * @module forest/solutions/solution-interactive-sections
 */

import React, { useState } from 'react';
import {
  Copy,
  Check,
  Send,
  Zap,
  DollarSign,
  Clock,
  Sparkles,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import type { SolutionIndustry } from '@/seed/types/solutions-types';

export interface SolutionInteractiveSectionsProps {
  industry: SolutionIndustry;
  locale: 'en' | 'vi';
}

export function SolutionInteractiveSections({
  industry,
  locale,
}: SolutionInteractiveSectionsProps) {
  const isVi = locale === 'vi';
  const [copied, setCopied] = useState(false);
  const [videoCount, setVideoCount] = useState(30);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const samplePrompt = isVi ? industry.samplePromptVi : industry.samplePromptEn;
  const telegramUrl = `https://t.me/Sophia_Bbot?start=sol_${industry.slug}`;
  const checkoutUrl = `/checkout?plan=starter&promo=SOLO100`;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(samplePrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // ROI calculations based on video count
  const agencyCostPerVideo = Math.round(industry.roiComparison.traditionalAgencyCostMonthlyUsd / 20);
  const totalAgencyCost = videoCount * agencyCostPerVideo;
  const sophiaCost = industry.roiComparison.sophiaMonthlyUsd; // Flat monthly subscription
  const totalSavings = Math.max(0, totalAgencyCost - sophiaCost);
  const timeSavedHours = Math.round(videoCount * 4.5); // Approx 4.5 hours per video production saved

  return (
    <div className="w-full space-y-16">
      {/* 1. Interactive Sample Video Prompt Section */}
      <section className="rounded-2xl border border-emerald-500/20 bg-zinc-900/80 p-6 sm:p-8 backdrop-blur-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              {isVi ? 'Mẫu Prompt Kịch Bản Thực Tế' : 'Ready-To-Run Production Prompt'}
            </div>
            <h3 className="text-xl font-bold text-white">
              {isVi ? industry.samplePromptTitleVi : industry.samplePromptTitleEn}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {isVi
                ? 'Sao chép câu lệnh này để thử nghiệm ngay trên Bot Telegram hoặc trong ứng dụng Sophia AI.'
                : 'Copy this prompt to test immediately in the Telegram Bot demo or your Sophia AI studio.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyPrompt}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{isVi ? 'Đã sao chép!' : 'Copied!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Sao chép prompt' : 'Copy prompt'}</span>
                </>
              )}
            </button>

            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isVi ? 'Chạy thử trên Telegram' : 'Run on Telegram Demo'}</span>
            </a>
          </div>
        </div>

        <div className="mt-5 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
          {samplePrompt}
        </div>
      </section>

      {/* 2. Interactive ROI & Cost Comparison Calculator */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur-md">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs font-semibold mb-2">
            <Percent className="w-3.5 h-3.5" />
            {isVi ? 'Bài Toán Lợi Nhuận ROI' : 'Interactive ROI Calculator'}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {isVi
              ? `So Sánh Chi Phí Sản Xuất Video Ngành ${industry.nameVi}`
              : `Traditional Agency vs Sophia AI Factory for ${industry.nameEn}`}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2">
            {isVi
              ? 'Xem số tiền và thời gian doanh nghiệp của bạn tiết kiệm được khi chuyển sang mô hình AI Video Factory tự động.'
              : 'Calculate your exact monthly capital savings and accelerated delivery speed.'}
          </p>
        </div>

        {/* Video Slider */}
        <div className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50">
          <div className="flex justify-between items-center text-xs font-medium mb-2">
            <span className="text-zinc-300">
              {isVi ? 'Số lượng video cần mỗi tháng:' : 'Target video output per month:'}
            </span>
            <span className="text-emerald-400 font-bold text-sm">{videoCount} videos</span>
          </div>
          <input
            type="range"
            min="10"
            max="120"
            step="5"
            value={videoCount}
            onChange={(e) => setVideoCount(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
            <span>10 videos</span>
            <span>60 videos</span>
            <span>120 videos</span>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Traditional Agency */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 relative">
            <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
              {isVi ? 'Thuê Agency / Ekip Truyền Thống' : 'Traditional Video Agency'}
            </div>
            <div className="text-3xl font-extrabold text-white">
              ${totalAgencyCost.toLocaleString()}
              <span className="text-xs font-normal text-zinc-400 ml-1">/{isVi ? 'tháng' : 'month'}</span>
            </div>
            <ul className="mt-5 space-y-3 text-xs text-zinc-300">
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  {isVi
                    ? 'Thời gian chờ: 10 - 14 ngày mỗi đợt duyệt clip'
                    : '10 - 14 day turnaround per batch'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  {isVi
                    ? `Chi phí trung bình: $${agencyCostPerVideo} / video đơn lẻ`
                    : `Average $${agencyCostPerVideo} per single finished video`}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-rose-400 font-bold shrink-0">✕</span>
                <span>
                  {isVi ? 'Giới hạn số lần sửa kịch bản & quay lại' : 'Strict limit on retakes and edits'}
                </span>
              </li>
            </ul>
          </div>

          {/* Sophia AI Factory */}
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 relative shadow-lg shadow-emerald-500/5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Sophia AI Factory
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                {isVi ? 'Tiết kiệm 90%+' : '90%+ Savings'}
              </span>
            </div>
            <div className="text-3xl font-extrabold text-white">
              ${sophiaCost}
              <span className="text-xs font-normal text-zinc-400 ml-1">/{isVi ? 'tháng' : 'month'}</span>
            </div>
            <ul className="mt-5 space-y-3 text-xs text-zinc-300">
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {isVi ? 'Thời gian xuất video: 60 giây' : 'Sub-60 second rendering speed'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {isVi
                    ? `Bạn tiết kiệm: $${totalSavings.toLocaleString()} / tháng`
                    : `Estimated savings: $${totalSavings.toLocaleString()} / month`}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {isVi
                    ? `Tiết kiệm ${timeSavedHours} giờ làm việc của nhân sự`
                    : `Saves ~${timeSavedHours} human production hours`}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Interactive FAQ Accordion */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur-md">
        <div className="text-center max-w-xl mx-auto mb-8">
          <h3 className="text-2xl font-bold text-white tracking-tight">
            {isVi ? 'Câu Hỏi Thường Gặp' : 'Frequently Asked Questions'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {isVi
              ? `Giải đáp chi tiết về giải pháp video AI cho ngành ${industry.nameVi}.`
              : `Everything you need to know about Sophia AI for ${industry.nameEn}.`}
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {industry.faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            const q = isVi ? faq.questionVi : faq.questionEn;
            const a = isVi ? faq.answerVi : faq.answerEn;

            return (
              <div
                key={index}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden transition"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full p-4 text-left flex items-center justify-between text-sm font-semibold text-zinc-200 hover:text-white transition"
                >
                  <span>{q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                      isOpen ? 'transform rotate-180 text-emerald-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-3">
                    {a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Bottom Conversion CTA with SOLO100 Promo Code */}
      <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-950 p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
        <div className="max-w-2xl mx-auto relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
            <ShieldCheck className="w-4 h-4" />
            {isVi ? 'Ưu Đãi Độc Quyền Cho Người Khởi Nghiệp' : 'Exclusive Early Adopter Offer'}
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {isVi
              ? `Bắt Đầu Tự Động Hóa Video Ngành ${industry.nameVi} Ngay Hôm Nay`
              : `Supercharge Your ${industry.nameEn} Growth Today`}
          </h2>

          <p className="text-sm text-zinc-300">
            {isVi
              ? 'Nhập mã SOLO100 khi thanh toán để được giảm ngay $100 (2.500.000 VNĐ). Trải nghiệm miễn phí bản demo trên Telegram trước khi đăng ký.'
              : 'Use promo code SOLO100 at checkout for an instant $100 OFF. Test our live interactive video generation directly on Telegram.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={checkoutUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition hover:scale-105"
            >
              <span>{isVi ? 'Kích hoạt ngay với SOLO100 (-$100)' : 'Claim $100 OFF with SOLO100'}</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold border border-zinc-700 transition"
            >
              <Send className="w-4 h-4 text-sky-400" />
              <span>{isVi ? 'Xem demo trên Telegram' : 'Test Telegram Demo'}</span>
            </a>
          </div>

          <div className="text-[11px] text-zinc-500 pt-2">
            {isVi
              ? 'Hỗ trợ thanh toán bảo mật bằng USDT (NOWPayments) & Chuyển khoản VietQR (PayOS).'
              : 'Secure settlement via NOWPayments USDT & PayOS VietQR with instant license delivery.'}
          </div>
        </div>
      </section>
    </div>
  );
}
