/**
 * Barrel for the canonical seed Inngest client and its merged event schema.
 * Prefer importing the client directly from '@/seed/inngest/client'.
 *
 * Layer: seed (foundational).
 *
 * @module seed/inngest
 */
export { inngest } from "./client";
export type { Events } from "./event-types";
export type {
  AgentMissionStartedData,
  AgentApprovalRequestedData,
  AgentApprovalResolvedData,
  AgentMissionCompletedData,
  AgentMissionFailedData,
} from "./agent-event-types";
