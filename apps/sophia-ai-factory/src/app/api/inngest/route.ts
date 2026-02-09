import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { helloWorld } from "@/lib/inngest/functions/hello-world";
import { generateCampaign } from "@/lib/inngest/functions/generate-campaign";
import { autoDiscoverAffiliates } from "@/lib/inngest/functions/auto-discover-affiliates";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    helloWorld,
    generateCampaign,
    autoDiscoverAffiliates,
  ],
});
