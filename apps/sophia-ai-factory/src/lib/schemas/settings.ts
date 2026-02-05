import { z } from 'zod';

// Profile Settings Schema
export const notificationsSchema = z.object({
  email: z.object({
    marketing: z.boolean().default(false),
    security: z.boolean().default(true),
    updates: z.boolean().default(true),
  }).optional(),
  telegram: z.object({
    enabled: z.boolean().default(false),
  }).optional(),
});

export const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  notifications: notificationsSchema.optional(),
});

// API Keys Schema
export const apiKeysSchema = z.object({
  openai: z.string().optional().or(z.literal('')),
  anthropic: z.string().optional().or(z.literal('')),
  elevenlabs: z.string().optional().or(z.literal('')),
});

// Combined Form Schema
export const userProfileFormSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').optional(),
  settings: settingsSchema,
  apiKeys: apiKeysSchema,
});

export type UserProfileFormValues = z.infer<typeof userProfileFormSchema>;
