'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface PublicLandingViewProps {
  locale: string;
  isVi: boolean;
}

export function PublicLandingView({ locale, isVi }: PublicLandingViewProps) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-16">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            {isVi ? 'Chương Trình Đại Lý & Đối Tác Toàn Cầu' : 'Global Partner & White-Label Agency Program'}
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-100 via-cyan-200 to-blue-400 bg-clip-text text-transparent">
            {isVi ? 'Kiếm Hoa Hồng Lên Đến 35% Trọn Đời' : 'Earn Up To 35% Lifetime Recurring Commissions'}
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto">
            {isVi
              ? 'Đồng hành cùng Sophia AI Factory xây dựng đế chế sản xuất video AI. Mở khóa nhãn trắng thương hiệu riêng, tên miền tùy biến và chia sẻ doanh thu hàng tháng.'
              : 'Scale your marketing agency with sovereign AI video infrastructure. Unlock full white-label capabilities, custom domains, and recurring revenue splits.'}
          </p>
          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/login?redirect=/partner`}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 shadow-lg shadow-cyan-500/25 transition-all"
            >
              {isVi ? 'Đăng Ký Làm Đại Lý Ngay' : 'Join Partner Program'}
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Tier Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">SILVER TIER</span>
              <span className="text-xl font-bold text-zinc-200">20%</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-100">{isVi ? 'Đối Tác Khởi Động' : 'Starter Affiliate'}</h3>
            <p className="text-sm text-zinc-400">
              {isVi ? 'Áp dụng cho mọi đối tác mới tham gia từ ngày đầu tiên.' : 'Immediate access for all new partners from day one.'}
            </p>
            <ul className="text-sm text-zinc-300 space-y-2 pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                {isVi ? 'Hoa hồng 20% định kỳ hàng tháng' : '20% recurring monthly commission'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                {isVi ? 'Cửa sổ ghi nhận 90 ngày' : '90-day referral attribution window'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                {isVi ? 'Rút tiền qua USDT & VietQR' : 'USDT & VietQR payouts'}
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-amber-500/30 relative space-y-4">
            <div className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              POPULAR
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">GOLD TIER</span>
              <span className="text-2xl font-black text-amber-400">28%</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-100">{isVi ? 'Đại Lý Tăng Trưởng' : 'Growth Agency'}</h3>
            <p className="text-sm text-zinc-400">
              {isVi ? 'Điều kiện: 10 khách hàng hoặc $5,000 MRR giới thiệu.' : 'Req: 10 paying customers OR $5,000 referred MRR.'}
            </p>
            <ul className="text-sm text-zinc-300 space-y-2 pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                {isVi ? 'Hoa hồng tăng vọt lên 28%' : 'Accelerated 28% recurring rate'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                {isVi ? 'Kênh hỗ trợ VIP kỹ thuật' : 'Priority technical support lane'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                {isVi ? 'Thưởng hiệu quả quý' : 'Quarterly performance bonuses'}
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-b from-cyan-950/40 to-zinc-900/80 border border-cyan-500/40 relative space-y-4">
            <div className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              WHITE-LABEL
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">PLATINUM TIER</span>
              <span className="text-2xl font-black text-cyan-400">35%</span>
            </div>
            <h3 className="text-xl font-bold text-zinc-100">{isVi ? 'Đế Chế Nhãn Trắng' : 'Sovereign White-Label'}</h3>
            <p className="text-sm text-zinc-400">
              {isVi ? 'Điều kiện: 30 khách hàng hoặc $20,000 MRR giới thiệu.' : 'Req: 30 paying customers OR $20,000 referred MRR.'}
            </p>
            <ul className="text-sm text-zinc-300 space-y-2 pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                {isVi ? 'Mức hoa hồng tối đa 35%' : 'Top-tier 35% commission rate'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                {isVi ? 'Nhãn trắng toàn diện & Tên miền riêng' : 'Full White-Label & Custom Domain'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                {isVi ? 'Tùy biến CSS, Logo & Thương hiệu' : 'Custom CSS, Logo & Brand Injection'}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
