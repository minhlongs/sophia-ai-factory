"use server";

import { getD1Client } from "@/seed/db/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tierGuard } from "@/lib/tier-guard";

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().min(1).max(200),
  category: z.enum(["welcome", "product", "seasonal", "promotion", "viral"]),
  icon: z.string().max(2).optional(),
  defaults: z.object({
    title: z.string(),
    audience: z.string(),
    tone: z.enum(["professional", "casual", "urgent", "friendly", "enthusiastic"]),
    suggestedDuration: z.number().min(5).max(300),
    keywords: z.array(z.string())
  })
});

export async function createTemplate(data: z.infer<typeof createTemplateSchema>) {
  const db = await getD1Client();

  // Get current user — for now derive from first user in dev
  // In production this should come from a validated auth token/session
  const { data: firstUser } = await db.from('users').select('id').limit(1).single();
  const userId = (firstUser as { id: string } | null)?.id;

  if (!userId) {
    return { success: false, message: "Unauthorized" };
  }

  // Check tier limits for custom templates
  const limitCheck = await tierGuard.checkLimit(userId, "videoTemplates");

  if (!limitCheck.allowed) {
    return {
      success: false,
      message: limitCheck.message || "Template limit reached",
      requiresUpgrade: true,
      requiredTier: limitCheck.requiredTier
    };
  }

  try {
    const { error } = await db
      .from("campaign_templates")
      .insert({
        user_id: userId,
        name: data.name,
        description: data.description,
        category: data.category,
        icon: data.icon || "📝",
        defaults: data.defaults,
        is_predefined: false
      });

    if (error) {
      return { success: false, message: "Failed to create template" };
    }

    revalidatePath("/dashboard/templates");
    return { success: true, message: "Template created successfully" };
  } catch {
    return { success: false, message: "Internal server error" };
  }
}
