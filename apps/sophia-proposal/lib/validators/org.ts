import { z } from "zod";

/**
 * Organization creation validation schema
 */
export const createOrgSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be less than 100 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be less than 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens"
    ),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

/**
 * Organization update validation schema
 */
export const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;

/**
 * Organization member invitation schema
 */
export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["owner", "admin", "member"], {
    errorMap: () => ({ message: "Role must be owner, admin, or member" }),
  }),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/**
 * Organization response schema
 */
export const orgResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  role: z.string().optional(),
});

export type OrgResponse = z.infer<typeof orgResponseSchema>;

/**
 * Organization member response schema
 */
export const orgMemberSchema = z.object({
  user_id: z.string(),
  email: z.string(),
  role: z.string(),
  created_at: z.string(),
});

export type OrgMember = z.infer<typeof orgMemberSchema>;
