import { IPaymentService, CreateCheckoutParams, CheckoutSession } from "../types";
import { configureLemonSqueezy } from "@/lib/lemonsqueezy";
import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";

export class RealPaymentService implements IPaymentService {
  constructor() {
    configureLemonSqueezy();
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const { productId, successUrl, customerEmail, metadata } = params;

    // productId in this context will be the Variant ID from Lemon Squeezy
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;

    if (!storeId) {
      throw new Error("LEMONSQUEEZY_STORE_ID is not configured");
    }

    const checkoutOptions = {
      productOptions: {
        redirectUrl: successUrl,
      },
      checkoutData: {
        email: customerEmail,
        custom: metadata,
      },
    };

    const { data, error } = await createCheckout(
      parseInt(storeId),
      parseInt(productId),
      checkoutOptions
    );

    if (error) {
      console.error("Lemon Squeezy Checkout Error:", error);
      throw new Error(`Failed to create checkout: ${error.message}`);
    }

    if (!data?.data?.attributes?.url) {
      throw new Error("Failed to retrieve checkout URL");
    }

    return {
      url: data.data.attributes.url,
      id: data.data.id,
    };
  }
}
