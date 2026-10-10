export type PaymentMethod = "nowpayments" | "payos";
export type BillingPeriod = "monthly" | "annual";

export interface CheckoutResponse {
  url?: string;
  orderId?: string;
  error?: string;
  redirectTo?: string;
  status?: string;
  handoverId?: string;
  magicLink?: string;
  message?: string;
}

export interface CheckoutData {
  tier: string;
  url?: string;
  orderId?: string;
  period: "monthly" | "yearly" | "lifetime";
  paymentMethod: PaymentMethod;
  priceCents: number;
  discountedPriceCents?: number;
  couponCode?: string;
}

export interface PricingSectionProps {
  isAuthenticated?: boolean;
}
