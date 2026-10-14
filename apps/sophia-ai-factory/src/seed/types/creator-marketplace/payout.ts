import { z } from 'zod';

export const PayoutRailSchema = z.enum(['USDT', 'VIETQR']);
export type PayoutRail = z.infer<typeof PayoutRailSchema>;

export const WithdrawalStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'rejected',
  'cancelled',
]);
export type WithdrawalStatus = z.infer<typeof WithdrawalStatusSchema>;

export const VietQrBankingConfigSchema = z.object({
  bankBin: z.string().regex(/^\d{6}$/, 'Bank BIN must be exactly 6 digits'),
  bankAccountNumber: z.string().min(4, 'Account number must be at least 4 chars').max(30),
  bankAccountName: z.string().min(2, 'Account holder name is required').max(100),
});
export type VietQrBankingConfig = z.infer<typeof VietQrBankingConfigSchema>;

export const WithdrawalRequestSchema = z.object({
  id: z.string(),
  creatorId: z.string(),
  amountCents: z.number().int().positive(),
  currency: z.string().default('USD'),
  rail: PayoutRailSchema,
  destinationAddress: z.string().optional().nullable(),
  bankBin: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankAccountName: z.string().optional().nullable(),
  status: WithdrawalStatusSchema.default('pending'),
  txHash: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
});
export type WithdrawalRequest = z.infer<typeof WithdrawalRequestSchema>;

export const CreateWithdrawalInputSchema = z
  .object({
    amountCents: z
      .number()
      .int()
      .min(5000, 'Minimum withdrawal amount is $50.00 (5,000 cents)'),
    rail: PayoutRailSchema,
    destinationAddress: z.string().optional(),
    bankBin: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankAccountName: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.rail === 'USDT') {
      if (!val.destinationAddress || val.destinationAddress.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationAddress'],
          message: 'Valid USDT wallet address is required for USDT rail',
        });
      }
    } else if (val.rail === 'VIETQR') {
      if (!val.bankBin || !/^\d{6}$/.test(val.bankBin.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bankBin'],
          message: 'Valid 6-digit NAPAS bank BIN is required for VietQR rail',
        });
      }
      if (!val.bankAccountNumber || val.bankAccountNumber.trim().length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bankAccountNumber'],
          message: 'Bank account number is required for VietQR rail',
        });
      }
      if (!val.bankAccountName || val.bankAccountName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bankAccountName'],
          message: 'Account holder name is required for VietQR rail',
        });
      }
    }
  });
export type CreateWithdrawalInput = z.infer<typeof CreateWithdrawalInputSchema>;

export const CreatorStudioStatsSchema = z.object({
  totalTemplates: z.number().int().nonnegative(),
  totalUses: z.number().int().nonnegative(),
  grossEarningsCents: z.number().int().nonnegative(),
  creatorRoyaltyCents: z.number().int().nonnegative(),
  platformFeesCents: z.number().int().nonnegative(),
  availableBalanceCents: z.number().int().nonnegative(),
  pendingBalanceCents: z.number().int().nonnegative(),
  averageRating: z.number().min(0).max(5),
  totalReviews: z.number().int().nonnegative(),
});
export type CreatorStudioStats = z.infer<typeof CreatorStudioStatsSchema>;
