import React from 'react';
import type { PayoutFormData } from './types';

interface PayoutDestinationFieldsProps {
  formData: PayoutFormData;
  setFormData: React.Dispatch<React.SetStateAction<PayoutFormData>>;
}

export function PayoutDestinationFields({
  formData,
  setFormData,
}: PayoutDestinationFieldsProps) {
  if (formData.rail === 'USDT') {
    return (
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          USDT Destination Address
        </label>
        <input
          type="text"
          value={formData.destinationAddress}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, destinationAddress: e.target.value }))
          }
          placeholder="0x... or T..."
          className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground focus:border-primary focus:outline-none"
          required
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Bank 6-Digit NAPAS BIN
        </label>
        <input
          type="text"
          maxLength={6}
          value={formData.bankBin}
          onChange={(e) => setFormData((prev) => ({ ...prev, bankBin: e.target.value }))}
          placeholder="e.g. 970422 (MB Bank), 970436 (VCB)"
          className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground focus:border-primary focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Account Number</label>
        <input
          type="text"
          value={formData.bankAccountNumber}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, bankAccountNumber: e.target.value }))
          }
          placeholder="Account number"
            className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground focus:border-primary focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Account Holder Name
        </label>
        <input
          type="text"
          value={formData.bankAccountName}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, bankAccountName: e.target.value }))
          }
          placeholder="NGUYEN VAN A"
          className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground focus:border-primary focus:outline-none uppercase"
          required
        />
      </div>
    </div>
  );
}
