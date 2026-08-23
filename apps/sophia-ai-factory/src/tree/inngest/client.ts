/**
 * @deprecated Deprecated client — use '@/seed/inngest/client' directly.
 *
 * The tree Inngest client was merged into the canonical seed client (same
 * app id, previously divergent schemas). This file is now a re-export shim;
 * it is registered in '@/seed/types/deprecation-markers' (target
 * '@/tree/inngest/client', removable after 2026-09-20).
 *
 * Layer: tree.
 */

export { inngest } from "@/seed/inngest/client";
export type {
  AgentMissionStartedData,
  AgentApprovalRequestedData,
  AgentApprovalResolvedData,
  AgentMissionCompletedData,
  AgentMissionFailedData,
} from "@/seed/inngest/agent-event-types";
