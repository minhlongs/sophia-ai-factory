import { Polar } from "@polar-sh/sdk";

const ACCESS_TOKEN = "polar_oat_Xu1CyntlLy9aDe7ymtGwSkmyKozlO1TRkd52F4evsY8";

async function setupWebhook() {
  const polar = new Polar({ accessToken: ACCESS_TOKEN, server: "production" });
  
  console.log("Checking existing webhooks...");
  
  // List all endpoints
  const endpoints = await polar.webhooks.endpoints.list();
  console.log("Existing endpoints:", endpoints);
  
  // Create webhook endpoint
  const webhook = await polar.webhooks.endpoints.create({
    url: "https://sophia-ai-factory.vercel.app/api/polar/webhook",
    secret: "sophia-webhook-secret-2026",
    events: ["order.paid", "subscription.active", "subscription.canceled", "subscription.updated"],
  });
  
  console.log("Webhook created:", webhook);
}

setupWebhook().catch(console.error);
