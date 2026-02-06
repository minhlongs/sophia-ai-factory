import { Checkout } from "@polar-sh/nextjs";

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?checkout=success`,
  returnUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  server: process.env.NODE_ENV === 'development' ? 'sandbox' : 'production',
  theme: 'dark',
});
