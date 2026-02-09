import { Polar } from "@polar-sh/sdk";

// Strip literal \n that Vercel CLI appends to env vars, then trim whitespace
const accessToken = (process.env.POLAR_ACCESS_TOKEN || '').replace(/\\n$/, '').trim();

export const polar = new Polar({
  accessToken,
  server: process.env.NODE_ENV === "development" ? "sandbox" : "production",
});
