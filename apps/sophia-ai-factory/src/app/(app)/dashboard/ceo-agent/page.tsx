import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { assertTierAllowsAgent, AgentTierBlockedError } from '@/forest/agents/enforcement-gate';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getTranslations } from 'next-intl/server';
import { CeoAgentShell } from './ceo-agent-shell';

export const dynamic = 'force-dynamic';

export default async function CeoAgentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const userTier = await getUserTier(user.id);
  try {
    assertTierAllowsAgent(userTier, 'CEO');
  } catch (e) {
    if (e instanceof AgentTierBlockedError) {
      redirect(`/${locale}/dashboard?upgrade=ceo`);
    }
    throw e;
  }

  const t = await getTranslations({ locale, namespace: 'dashboard.ceoAgent' });

  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">{t('loading')}</div>}>
      <CeoAgentShell locale={locale} userId={user.id} />
    </Suspense>
  );
}
