/**
 * Types & models for Admin SOP Reviews
 */

export interface SopListing {
  id: string;
  title: string;
  sop_template_id: string;
  creator_name: string;
  creator_user_id: string;
  category: string | null;
  price_cents: number;
  created_at: number;
  updated_at: number;
  install_count: number;
  rating: number;
  status: string;
}

export interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function checkAdminAccess(): Promise<{
  hasAccess: boolean;
  isAdmin: boolean;
  userId: string | null;
}> {
  const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
  const { resolveUserTier } = await import('@/seed/db/resolve-user-tier');

  const user = await getCurrentUser();
  if (!user) {
    return { hasAccess: false, isAdmin: false, userId: null };
  }

  const tier = await resolveUserTier(user.id);
  const isAdmin = tier === 'MASTER' || tier === 'ENTERPRISE';

  return { hasAccess: isAdmin, isAdmin, userId: user.id };
}
