/**
 * Video Templates Management
 *
 * Template library for video generation with caching
 */

import { createServerClient } from "@/lib/db/client";
import type { VideoTemplate, VideoTemplateInsert } from "@/types/video";

/**
 * Get all available templates for an organization
 * Includes global templates + org-specific templates
 */
export async function getAvailableTemplates(
  orgId?: string
): Promise<VideoTemplate[]> {
  const db = createServerClient();

  let query = db
    .from<VideoTemplate>("video_templates")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (orgId) {
    // Get both global and org-specific templates
    const { data: globalTemplates } = await db
      .from<VideoTemplate>("video_templates")
      .select("*")
      .is("org_id", null)
      .eq("is_active", true);

    const { data: orgTemplates } = await db
      .from<VideoTemplate>("video_templates")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true);

    return [...(globalTemplates || []), ...(orgTemplates || [])];
  }

  const { data, error } = await query.is("org_id", null);

  if (error) {
    console.error("Error fetching templates:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get a specific template by ID
 */
export async function getTemplateById(
  templateId: string,
  orgId?: string
): Promise<VideoTemplate | null> {
  const db = createServerClient();

  const { data, error } = await db
    .from<VideoTemplate>("video_templates")
    .select("*")
    .eq("id", templateId)
    .eq("is_active", true);

  if (error) {
    console.error("Error fetching template:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Filter by org if provided
  if (orgId) {
    return data.find(t => t.org_id === null || t.org_id === orgId) || null;
  }

  return data.find(t => t.org_id === null) || null;
}

/**
 * Create a new organization-specific template
 */
export async function createTemplate(
  orgId: string,
  template: VideoTemplateInsert
): Promise<VideoTemplate> {
  const db = createServerClient();

  const { data, error } = await db
    .from<VideoTemplate>("video_templates")
    .insert({
      ...template,
      org_id: orgId,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error creating template:", error);
    throw error ?? new Error('Template insert returned no data');
  }

  return data;
}

/**
 * Update a template
 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<VideoTemplateInsert>,
  orgId: string
): Promise<VideoTemplate | null> {
  const db = createServerClient();

  const { data, error } = await db
    .from<VideoTemplate>("video_templates")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) {
    console.error("Error updating template:", error);
    throw error;
  }

  return data;
}

/**
 * Delete (deactivate) a template
 */
export async function deleteTemplate(
  templateId: string,
  orgId: string
): Promise<void> {
  const db = createServerClient();

  const { error } = await db
    .from<VideoTemplate>("video_templates")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .eq("org_id", orgId);

  if (error) {
    console.error("Error deleting template:", error);
    throw error;
  }
}

/**
 * Get templates by type
 */
export async function getTemplatesByType(
  type: "intro" | "section" | "full_proposal" | "custom",
  orgId?: string
): Promise<VideoTemplate[]> {
  const db = createServerClient();

  if (orgId) {
    // Get both global and org-specific templates
    const { data: globalTemplates } = await db
      .from<VideoTemplate>("video_templates")
      .select("*")
      .eq("template_type", type)
      .eq("is_active", true)
      .is("org_id", null);

    const { data: orgTemplates } = await db
      .from<VideoTemplate>("video_templates")
      .select("*")
      .eq("template_type", type)
      .eq("is_active", true)
      .eq("org_id", orgId);

    return [...(globalTemplates || []), ...(orgTemplates || [])];
  }

  const { data, error } = await db
    .from<VideoTemplate>("video_templates")
    .select("*")
    .eq("template_type", type)
    .eq("is_active", true)
    .is("org_id", null);

  if (error) {
    console.error("Error fetching templates by type:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get default template for video type
 */
export async function getDefaultTemplate(
  type: "intro" | "section" | "full_proposal" | "custom"
): Promise<VideoTemplate | null> {
  const db = createServerClient();

  const { data, error } = await db
    .from<VideoTemplate>("video_templates")
    .select("*")
    .eq("template_type", type)
    .eq("is_active", true)
    .is("org_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching default template:", error);
    throw error;
  }

  return data;
}
