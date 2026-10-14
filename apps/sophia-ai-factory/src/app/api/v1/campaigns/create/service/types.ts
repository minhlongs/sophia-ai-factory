/**
 * Campaign Creation Request Schemas & Types
 *
 * Layer: app/api/v1/campaigns/create/service
 */

import { z } from "zod";

export const createCampaignBodySchema = z.object({
  script: z.string().min(1, "script is required"),
  title: z.string().optional(),
  avatar_id: z.string().optional(),
  voice_id: z.string().optional(),
  // userId is OPTIONAL in body — the authoritative userId comes from the API key's license record.
  // Providing it is allowed only for forward-compatibility; any mismatch triggers a 403.
  userId: z.string().optional(),
});

export type CreateCampaignBody = z.infer<typeof createCampaignBodySchema>;

export interface RaasApiKeyValidationResult {
  valid: boolean;
  /** userId derived from the license record (raas_licenses.user_id). Null if key invalid. */
  userId: string | null;
  orgId?: string | null;
}
