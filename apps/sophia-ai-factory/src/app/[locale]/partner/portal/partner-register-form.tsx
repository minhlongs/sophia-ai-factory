'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { PartnerType } from '@/tree/partners/types';

interface PartnerRegisterFormProps {
  isVi: boolean;
  registerName: string;
  setRegisterName: (val: string) => void;
  registerType: PartnerType;
  setRegisterType: (val: PartnerType) => void;
  registerCode: string;
  setRegisterCode: (val: string) => void;
  registerError: string | null;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function PartnerRegisterForm({
  isVi,
  registerName,
  setRegisterName,
  registerType,
  setRegisterType,
  registerCode,
  setRegisterCode,
  registerError,
  isPending,
  onSubmit,
}: PartnerRegisterFormProps) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-16 px-4 sm:px-6">
      <div className="max-w-xl mx-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-zinc-100">
            {isVi ? 'Kích Hoạt Tài Khoản Đối Tác' : 'Activate Partner Account'}
          </h2>
          <p className="text-sm text-zinc-400">
            {isVi
              ? 'Nhập tên đại lý của bạn để nhận mã giới thiệu riêng và bắt đầu kiếm hoa hồng tự động.'
              : 'Enter your agency or partner details to receive your dedicated referral tracking link.'}
          </p>
        </div>

        {registerError && (
          <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{registerError}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
              {isVi ? 'Tên Đại Lý / Tổ Chức' : 'Partner / Agency Name'}
            </label>
            <input
              type="text"
              required
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              placeholder={isVi ? 'Ví dụ: Alpha Digital Agency' : 'e.g. Alpha Digital Agency'}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
              {isVi ? 'Mô Hình Đối Tác' : 'Partner Type'}
            </label>
            <select
              value={registerType}
              onChange={(e) => setRegisterType(e.target.value as PartnerType)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500"
            >
              <option value="agency">Agency (Marketing / Creative Agency)</option>
              <option value="reseller">Reseller (Software / B2B Reseller)</option>
              <option value="affiliate">Affiliate (KOL / Content Creator)</option>
              <option value="integrator">Integrator (Tech / CRM Integrator)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
              {isVi ? 'Mã Giới Thiệu Tùy Chọn (Để trống để tự sinh)' : 'Custom Referral Code (Optional)'}
            </label>
            <input
              type="text"
              value={registerCode}
              onChange={(e) => setRegisterCode(e.target.value.toUpperCase())}
              placeholder="e.g. ALPHA2026"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-xl font-semibold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-colors disabled:opacity-50"
            >
              {isPending
                ? isVi
                  ? 'Đang kích hoạt...'
                  : 'Activating...'
                : isVi
                ? 'Kích Hoạt Tài Khoản Đối Tác'
                : 'Activate Partner Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
