'use client';

import React from 'react';
import { Lock, QrCode, Check, Tag } from 'lucide-react';
import { Card, Input } from '@/components/stitch';
import type { PaymentMethod } from './types';

interface PaymentMethodsProps {
  paymentMethod: PaymentMethod;
  onSelectPaymentMethod: (method: PaymentMethod) => void;
  couponCode: string;
  onCouponCodeChange: (code: string) => void;
}

export function PaymentMethods({
  paymentMethod,
  onSelectPaymentMethod,
  couponCode,
  onCouponCodeChange,
}: PaymentMethodsProps) {
  return (
    <>
      {/* Step 2: Payment Rail */}
      <Card padding="lg">
        <h2 className="text-lg font-bold text-foreground mb-4">2. Select Payment Rail</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* NOWPayments USDT */}
          <div
            onClick={() => onSelectPaymentMethod('nowpayments')}
            className={`
              p-4 rounded-xl cursor-pointer border-2 transition-all
              ${paymentMethod === 'nowpayments'
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-border bg-card/50 hover:bg-muted/50'
              }
            `}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-foreground text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                NOWPayments (USDT)
              </span>
              {paymentMethod === 'nowpayments' && <Check className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              TRC20, Polygon & Arbitrum with near-zero gas fees. Global instant confirmation.
            </p>
          </div>

          {/* PayOS VietQR */}
          <div
            onClick={() => onSelectPaymentMethod('payos')}
            className={`
              p-4 rounded-xl cursor-pointer border-2 transition-all
              ${paymentMethod === 'payos'
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-border bg-card/50 hover:bg-muted/50'
              }
            `}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-foreground text-sm flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-400" />
                PayOS (VietQR 24/7)
              </span>
              {paymentMethod === 'payos' && <Check className="w-4 h-4 text-emerald-400" />}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Napas 247 chuyển khoản ngân hàng Việt Nam. Quét mã QR thanh toán tức thì.
            </p>
          </div>
        </div>
      </Card>

      {/* Step 3: Promo / Voucher */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Promo Code or Voucher</h2>
        </div>
        <div className="flex gap-2">
          <Input
            value={couponCode}
            onChange={(e) => onCouponCodeChange(e.target.value)}
            placeholder="Enter coupon code (e.g. VIP2026)"
            className="uppercase text-sm"
          />
        </div>
      </Card>
    </>
  );
}
