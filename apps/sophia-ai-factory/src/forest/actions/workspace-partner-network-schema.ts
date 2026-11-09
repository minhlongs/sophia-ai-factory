/**
 * Zod Schemas and Types for Workspace Partner Network Management
 *
 * Used by Cloud-gated workspace owners to manage their recruited affiliate partners,
 * review `under_review` risk flags, and export Dual-Rail (VietQR + USDT) payout batches.
 *
 * Layer: forest (Server Action Schemas)
 * @module forest/actions/workspace-partner-network-schema
 */

import { z } from 'zod';

export const workspacePayoutRailSchema = z.enum(['VIETQR', 'USDT']);

export const recruitWorkspacePartnerSchema = z
  .object({
    partnerCode: z
      .string()
      .trim()
      .min(3, 'Partner code must be at least 3 characters')
      .max(32, 'Partner code must be at most 32 characters')
      .regex(/^[A-Za-z0-9_-]+$/, 'Partner code may only contain letters, numbers, _ or -'),
    commissionRatePct: z.number().min(1).max(80).default(20),
    payoutRail: workspacePayoutRailSchema.default('VIETQR'),
    bankBin: z.string().trim().optional(),
    bankAccountNumber: z.string().trim().optional(),
    bankAccountName: z.string().trim().optional(),
    usdtAddress: z.string().trim().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.payoutRail === 'VIETQR') {
      if (!val.bankBin || !/^\d{6}$/.test(val.bankBin)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'NAPAS Bank BIN (6 digits) is required for VietQR rail',
          path: ['bankBin'],
        });
      }
      if (!val.bankAccountNumber || !/^[A-Za-z0-9]{6,34}$/.test(val.bankAccountNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bank account number (6-34 alphanumeric chars) is required for VietQR rail',
          path: ['bankAccountNumber'],
        });
      }
      if (
        !val.bankAccountName ||
        val.bankAccountName.length < 2 ||
        val.bankAccountName.length > 100 ||
        !/^[A-Za-z0-9\s._-]+$/.test(val.bankAccountName)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Account holder name (2-100 safe characters) is required for VietQR rail',
          path: ['bankAccountName'],
        });
      }
    } else if (val.payoutRail === 'USDT') {
      if (!val.usdtAddress || !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(val.usdtAddress)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valid TRC-20 USDT address (starts with T, 34 chars) is required',
          path: ['usdtAddress'],
        });
      }
    }
  });

export type RecruitWorkspacePartnerInput = z.infer<typeof recruitWorkspacePartnerSchema>;

export const reviewWorkspacePartnerStatusSchema = z.object({
  partnerId: z.string().trim().min(1, 'Partner ID is required'),
  decision: z.enum(['approve', 'suspend']),
});

export type ReviewWorkspacePartnerStatusInput = z.infer<typeof reviewWorkspacePartnerStatusSchema>;

export const createWorkspaceDualRailBatchSchema = z.object({
  rail: z.enum(['COMBINED', 'VIETQR', 'USDT']).default('COMBINED'),
  minPayoutCents: z.number().int().min(100).default(5000),
});

export type CreateWorkspaceDualRailBatchInput = z.infer<typeof createWorkspaceDualRailBatchSchema>;

export interface WorkspacePartnerSummary {
  id: string;
  partnerCode: string;
  tier: string;
  commissionRatePct: number;
  payoutRail: 'VIETQR' | 'USDT';
  status: 'active' | 'under_review' | 'suspended';
  riskScore: number;
  isSuspicious: boolean;
  totalEarningsCents: number;
  pendingPayoutCents: number;
  bankBin: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  usdtAddressMasked: string | null;
}
