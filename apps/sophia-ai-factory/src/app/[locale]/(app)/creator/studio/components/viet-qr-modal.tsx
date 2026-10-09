'use client';

import React from 'react';
import type { ActiveQrModalState } from './types';

interface VietQrModalProps {
  isVi: boolean;
  modalData: ActiveQrModalState | null;
  onClose: () => void;
}

export function VietQrModal({ isVi, modalData, onClose }: VietQrModalProps) {
  if (!modalData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4 text-center shadow-2xl">
        <h3 className="font-bold text-base text-zinc-100">
          {isVi ? 'Mã VietQR Chuyển Khoản' : 'VietQR Transfer Code'}
        </h3>
        <p className="text-xs text-zinc-400">
          {modalData.bankName} • {modalData.accountNumber}
        </p>

        <div className="p-3 bg-white rounded-xl mx-auto w-fit shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={modalData.qrUrl}
            alt="VietQR Payout"
            className="w-56 h-56 object-contain"
          />
        </div>

        <div className="text-sm font-semibold text-emerald-400">
          {modalData.amountVnd.toLocaleString('vi-VN')} VND
          <span className="text-xs text-zinc-400 block font-normal">
            (${modalData.amountUsd.toFixed(2)} USD)
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium"
        >
          {isVi ? 'Đóng' : 'Close'}
        </button>
      </div>
    </div>
  );
}
