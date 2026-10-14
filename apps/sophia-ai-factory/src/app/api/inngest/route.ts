import { serve } from "inngest/next";
import { inngest } from "@/forest/inngest/client";
import { ALL_INNGEST_FUNCTIONS } from "./serve/index";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: ALL_INNGEST_FUNCTIONS,
});
