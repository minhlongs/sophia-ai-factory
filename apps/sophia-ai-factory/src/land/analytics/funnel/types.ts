export interface ActivationFunnel {
  /** Unix seconds, inclusive. */
  fromTs: number;
  /** Unix seconds, inclusive. */
  toTs: number;
  signups: number;
  firstLogin: number;
  firstVideo: number;
  firstConversion: number;
  conversions: {
    signupToLogin: number;
    loginToVideo: number;
    videoToConversion: number;
  };
}

/** Tier-to-tier upgrade/downgrade counts within a time window. */
export interface TierTransition {
  fromTier: string;
  toTier: string;
  count: number;
}

export interface TierConversionRates {
  fromTs: number;
  toTs: number;
  /** All tier transitions in the window (upgrade + activate + downgrade). */
  transitions: TierTransition[];
  /** Free → any paid tier activations. */
  freeToPaid: number;
  /** BASIC → PREMIUM upgrades. */
  basicToPremium: number;
  /** PREMIUM → ENTERPRISE upgrades. */
  premiumToEnterprise: number;
  /** ENTERPRISE → MASTER upgrades. */
  enterpriseToMaster: number;
  /** Any cancellations (downgrade or cancel). */
  cancellations: number;
}

export interface PromoCodeEffectiveness {
  fromTs: number;
  toTs: number;
  /** Total promo redemptions in window (all statuses). */
  total: number;
  /** Successfully redeemed (status = 'redeemed'). */
  redeemed: number;
  /** Reserved but not yet confirmed (status = 'reserved'). */
  reserved: number;
  /** Reverted / cancelled redemptions. */
  reverted: number;
  /** Redemption success rate: redeemed / (redeemed + reserved + reverted). */
  successRate: number;
  /** Top promo codes by redemption count. */
  topCodes: Array<{ code: string; count: number }>;
}

export interface CheckoutAbandonmentRate {
  fromTs: number;
  toTs: number;
  /** checkout_started signals fired (pending_orders written). */
  checkoutStarted: number;
  /** payment_success signals fired (IPN confirmed). */
  paymentSuccess: number;
  /** Abandonment rate: (started - success) / started. */
  abandonmentRate: number;
}
