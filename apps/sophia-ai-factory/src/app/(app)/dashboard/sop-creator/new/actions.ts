'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { hasCreatorAccess } from '@/land/sop-marketplace';
import { createSopListing } from '@/land/sop-marketplace/listing-manager';
import { logger } from '@/seed/utils/logger-utility';

export async function createNewListing(formData: {
  title: string;
  description?: string;
  priceCents: number;
  category?: string;
  tags?: string;
  thumbnailUrl?: string;
  demovideoUrl?: string;
  sopTemplateId: string;
}): Promise<{ success: boolean; data?: { listingId: string }; error?: { message: string } }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: { message: 'Authentication required' } };
    }

    const d1 = getD1();
    if (!d1) {
      return { success: false, error: { message: 'Database not available' } };
    }

    // Check creator access
    const hasAccess = await hasCreatorAccess(d1, user.id);
    if (!hasAccess) {
      return { success: false, error: { message: 'Creator access required' } };
    }

    // Validate required fields
    if (!formData.title || !formData.sopTemplateId) {
      return { success: false, error: { message: 'Title and SOP Template ID are required' } };
    }

    const priceCents = Math.round(formData.priceCents * 100);

    const result = await createSopListing({
      title: formData.title,
      description: formData.description,
      priceCents,
      category: formData.category,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      thumbnailUrl: formData.thumbnailUrl,
      demovideoUrl: formData.demovideoUrl,
      sopTemplateId: formData.sopTemplateId,
    });

    if (result.ok) {
      logger.info('[NewListing] Created', { userId: user.id, listingId: result.value.listingId });
      return { success: true, data: { listingId: result.value.listingId } };
    } else {
      return { success: false, error: { message: result.error.message } };
    }
  } catch (err) {
    logger.error('[NewListing] Error', err instanceof Error ? err : new Error(String(err)));
    return { success: false, error: { message: 'An unexpected error occurred' } };
  }
}