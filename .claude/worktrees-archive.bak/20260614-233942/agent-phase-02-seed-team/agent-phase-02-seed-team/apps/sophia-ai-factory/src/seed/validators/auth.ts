import { z } from "zod";

/**
 * Sign up validation schema
 */
export const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

/**
 * Sign in validation schema
 */
export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Magic link validation schema
 */
export const magicLinkSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

/**
 * Logout validation schema
 */
export const logoutSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
});

export type LogoutInput = z.infer<typeof logoutSchema>;

/**
 * Auth response schema
 */
export const authResponseSchema = z.object({
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      created_at: z.string(),
    })
    .nullable(),
  error: z.string().nullable(),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
