import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// PayOS credentials - MUST be configured
const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID;
const PAYOS_API_KEY = process.env.PAYOS_API_KEY;
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;

interface PaymentItem {
  name: string;
  quantity: number;
  price: number;
}

interface CustomerInfo {
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  note?: string;
}

interface CreatePaymentRequest {
  amount: number;
  items: PaymentItem[];
  customerInfo: CustomerInfo;
}

function generateOrderCode(): number {
  // Generate unique order code (timestamp + random)
  return Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000);
}

function createSignature(data: string): string {
  if (!PAYOS_CHECKSUM_KEY) {
    throw new Error("PAYOS_CHECKSUM_KEY is not configured");
  }
  return crypto
    .createHmac("sha256", PAYOS_CHECKSUM_KEY)
    .update(data)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    // Security check: Validate environment configuration
    if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) {
      console.error("PayOS configuration missing");

      // ONLY allow mock response in development mode
      if (process.env.NODE_ENV === "development") {
        const orderCode = generateOrderCode();
        return NextResponse.json({
          success: true,
          orderCode,
          checkoutUrl: `/checkout/success?orderCode=${orderCode}&demo=true`,
          message: "DEV MODE: PayOS credentials missing, mocking success",
        });
      }

      return NextResponse.json(
        { error: "Payment service configuration error" },
        { status: 500 }
      );
    }

    const body: CreatePaymentRequest = await request.json();
    const { amount, items, customerInfo } = body;

    // Validate required fields
    if (!amount || !items || !customerInfo) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const orderCode = generateOrderCode();
    const description = `84tea - Đơn hàng #${orderCode}`;
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/checkout/success?orderCode=${orderCode}`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/checkout?cancelled=true`;

    // PayOS payment data
    const paymentData = {
      orderCode,
      amount,
      description,
      items: items.map((item) => ({
        name: item.name.substring(0, 50), // PayOS limit
        quantity: item.quantity,
        price: item.price,
      })),
      returnUrl,
      cancelUrl,
      buyerName: customerInfo.name,
      buyerPhone: customerInfo.phone,
      buyerEmail: customerInfo.email || "",
      buyerAddress: `${customerInfo.address}, ${customerInfo.city}`,
    };

    // Create signature for PayOS
    const signatureData = `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`;
    const signature = createSignature(signatureData);

    // Call PayOS API
    const payosResponse = await fetch("https://api-merchant.payos.vn/v2/payment-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": PAYOS_CLIENT_ID,
        "x-api-key": PAYOS_API_KEY,
      },
      body: JSON.stringify({
        ...paymentData,
        signature,
      }),
    });

    const payosData = await payosResponse.json();

    if (payosData.code === "00" && payosData.data) {
      // Success - return checkout URL
      return NextResponse.json({
        success: true,
        orderCode,
        checkoutUrl: payosData.data.checkoutUrl,
        qrCode: payosData.data.qrCode,
      });
    } else {
      // PayOS error
      console.error("PayOS error code:", payosData.code, "desc:", payosData.desc);

      return NextResponse.json(
        { error: payosData.desc || "Payment creation failed" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Payment API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
