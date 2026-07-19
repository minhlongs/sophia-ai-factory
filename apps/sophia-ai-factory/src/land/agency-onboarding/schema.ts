import { z } from 'zod'

export const agencyTierEnum = z.enum(['starter', 'growth', 'enterprise'])
export type AgencyTier = z.infer<typeof agencyTierEnum>

export const agencySlugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Only lowercase letters, numbers, and single hyphens allowed')
  .refine((s) => !s.startsWith('-') && !s.endsWith('-'), 'Slug must not start or end with a hyphen')

export const agencyRegisterSchema = z.object({
  slug: agencySlugSchema,
  name: z.string().min(1, 'Name is required').max(120, 'Name too long'),
  ownerUserId: z.coerce.number().int().positive(),
  tier: agencyTierEnum.default('starter'),
  billingEmail: z.string().email().optional(),
  brandingJson: z.string().optional(),
})

export type AgencyRegisterInput = z.infer<typeof agencyRegisterSchema>

export const agencyUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  billingEmail: z.string().email().optional().nullable(),
  brandingJson: z.string().optional().nullable(),
  status: z.enum(['active', 'suspended', 'cancelled']).optional(),
})

export type AgencyUpdateInput = z.infer<typeof agencyUpdateSchema>
