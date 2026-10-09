/**
 * Enterprise Deals Zod Validation Schemas
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module seed/types/enterprise-deal/deal-schemas
 */

import { z } from 'zod';
import {
  DEAL_SOURCES,
  DEAL_STAGES,
  PIPELINE_TIERS,
  DEAL_CURRENCIES,
  ASSIGNED_AGENT_ROLES,
  SANDBOX_STATUSES,
  PROPOSAL_LANGUAGES,
} from './deal-constants';
import type { BantScoreInput } from './bant-types';

export const CreateEnterpriseDealSchema = z.object({
  leadName: z.string().min(1, 'Lead name is required').max(200),
  leadEmail: z.string().email('Invalid email address'),
  leadPhone: z.string().max(50).optional().nullable(),
  leadTitle: z.string().max(100).optional().nullable(),
  companyName: z.string().min(1, 'Company name is required').max(200),
  companyDomain: z.string().min(1, 'Domain is required').max(255),
  leadSource: z.enum(DEAL_SOURCES).optional().default('website'),
  dealStage: z.enum(DEAL_STAGES).optional().default('new_lead'),
  dealValueEstimateCents: z.number().int().nonnegative().optional().default(0),
  currency: z.enum(DEAL_CURRENCIES).optional().default('USD'),
  requestedMcuMonthly: z.number().int().nonnegative().optional().default(0),
  notes: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  bantInput: z.custom<BantScoreInput>().optional(),
});

export type CreateEnterpriseDealInput = z.input<typeof CreateEnterpriseDealSchema>;

export const UpdateEnterpriseDealSchema = z.object({
  leadName: z.string().min(1).max(200).optional(),
  leadEmail: z.string().email().optional(),
  leadPhone: z.string().max(50).optional().nullable(),
  leadTitle: z.string().max(100).optional().nullable(),
  companyName: z.string().min(1).max(200).optional(),
  companyDomain: z.string().min(1).max(255).optional(),
  leadSource: z.enum(DEAL_SOURCES).optional(),
  dealStage: z.enum(DEAL_STAGES).optional(),
  pipelineTier: z.enum(PIPELINE_TIERS).optional(),
  dealValueEstimateCents: z.number().int().nonnegative().optional(),
  currency: z.enum(DEAL_CURRENCIES).optional(),
  requestedMcuMonthly: z.number().int().nonnegative().optional(),
  assignedAgentId: z.string().optional().nullable(),
  assignedAgentRole: z.enum(ASSIGNED_AGENT_ROLES).optional(),
  meetingPrepBrief: z.string().optional().nullable(),
  proposalId: z.string().optional().nullable(),
  proposalLanguage: z.enum(PROPOSAL_LANGUAGES).optional(),
  proposalContent: z.string().optional().nullable(),
  sandboxSubaccountId: z.string().optional().nullable(),
  sandboxStatus: z.enum(SANDBOX_STATUSES).optional(),
  sandboxToken: z.string().optional().nullable(),
  sandboxExpiresAt: z.number().int().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateEnterpriseDealInput = z.infer<typeof UpdateEnterpriseDealSchema>;
