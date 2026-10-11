export interface CheckoutPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tier: string;
  priceCents: number;
  discountedPriceCents?: number;
  period: "monthly" | "yearly" | "lifetime";
  paymentMethod: "nowpayments" | "payos";
  couponCode?: string;
  checkoutUrl?: string;
  orderId?: string;
  locale: string;
}

export interface PricingSummaryProps {
  tier: string;
  periodLabel: string;
  priceCents: number;
  discountedPriceCents?: number;
  originalPriceFormatted: string;
  finalPriceFormatted: string;
  couponCode?: string;
  paymentMethod: "nowpayments" | "payos";
  vndFormatted: string;
  checkoutUrl?: string;
}

export interface PaymentQrSectionProps {
  checkoutUrl?: string;
  qrCodeSrc: string;
  paymentMethod: "nowpayments" | "payos";
  checking: boolean;
  paymentStatus: "pending" | "completed" | "failed" | null;
  onVerifyStatus: () => void;
}
