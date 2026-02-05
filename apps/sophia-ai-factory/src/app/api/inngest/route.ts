import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { helloWorld } from "@/lib/inngest/functions/hello-world";
import { generateCampaign } from "@/lib/inngest/functions/generate-campaign";

// Create an API that serves zero functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    helloWorld,
    generateCampaign,
  ],
});
