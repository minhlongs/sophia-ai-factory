/**
 * Zod schemas for usage export API
 * @module app/api/usage/export/usage-export-schemas
 */

import { z } from 'zod'

export const exportQuerySchema = z.object({
  start: z.string().transform((val) => parseInt(val, 10)),
  end: z.string().transform((val) => parseInt(val, 10)),
  format: z.enum(['json', 'csv']).default('json'),
  service: z.enum(['heygen', 'elevenlabs', 'openrouter']).optional(),
  license_nonce: z.string().optional(),
})

export const postExportRequestSchema = z.object({
  billingPeriod: z.enum(['weekly', 'monthly', 'custom']),
  startDate: z.number().optional(),
  endDate: z.number().optional(),
  externalCustomerId: z.string().optional().nullable(),
  format: z.enum(['json', 'csv']).default('json'),
  service: z.string().optional().nullable(),
  licenseNonce: z.string().optional().nullable(),
  page: z.number().default(1),
  pageSize: z.number().default(100),
})
