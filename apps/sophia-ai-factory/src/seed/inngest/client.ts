/**
 * Canonical Inngest client for Sophia AI Factory — the only Inngest client
 * instantiation in the codebase. Its schema is the merged union of the former
 * seed and tree event records (see ./event-types, ./agent-event-types).
 *
 * The legacy tree and forest clients re-export this instance.
 *
 * Layer: seed (foundational — no domain imports).
 *
 * @module seed/inngest/client
 */

import { Inngest, EventSchemas } from "inngest";
import { Events } from "./event-types";

export const inngest = new Inngest({
  id: "sophia-ai-factory",
  schemas: new EventSchemas().fromRecord<Events>(),
});
