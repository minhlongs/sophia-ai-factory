'use client';

import React from 'react';
import type { WithdrawFormData } from './types';
import { NAPAS_BANKS, USD_TO_VND_RATE } from './constants';

export function WithdrawalRailDestinationFields({
  isVi,
  formData,
  onChange,
}: {
  isVi: boolean;
  formData: WithdrawFormData;
  onChange: (data: WithdrawFormData) => void;
}) {
  if (formData.rail === 'USDT') {
    return (
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isVi ? 'Địa Chỉ Ví USDT TRC-20 *' : 'USDT TRC-20 Wallet Address *'}
        </label>
        <input
          required
          type="text"
          value={formData.destinationAddress}
          onChange={(e) => onChange({ ...formData, destinationAddress: e.target.value })}
          placeholder="T..."
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isVi ? 'Ngân Hàng Thụ Hưởng (NAPAS) *' : 'Beneficiary Bank (NAPAS) *'}
        </label>
        <select
          value={formData.bankBin}
          onChange={(e) => onChange({ ...formData, bankBin: e.target.value })}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
        >
          {NAPAS_BANKS.map((b) => (
            <option key={b.bin} value={b.bin}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isVi ? 'Số Tài Khoản Ngân Hàng *' : 'Bank Account Number *'}
        </label>
        <input
          required
          type="text"
          value={formData.bankAccountNumber}
          onChange={(e) => onChange({ ...formData, bankAccountNumber: e.target.value })}
          placeholder="0123456789"
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isVi ? 'Tên Chủ Tài Khoản (Không Dấu) *' : 'Account Holder Name *'}
        </label>
        <input
          required
          type="text"
          value={formData.bankAccountName}
          onChange={(e) => onChange({ ...formData, bankAccountName: e.target.value.toUpperCase() })}
          placeholder="NGUYEN VAN A"
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="p-2.5 rounded bg-zinc-800/80 border border-zinc-700 text-xs text-zinc-300">
        <span className="text-zinc-400">{isVi ? 'Ước tính quy đổi:' : 'Est. Exchange:'} </span>
        <span className="font-semibold text-emerald-400">
          {(parseFloat(formData.amountDollars || '0') * USD_TO_VND_RATE).toLocaleString('vi-VN')} VND
        </span>
        <span className="text-[10px] text-zinc-500 ml-1">(Tỉ giá 1 USD = 25,450 VND)</span>
      </div>
    </div>
  );
}
