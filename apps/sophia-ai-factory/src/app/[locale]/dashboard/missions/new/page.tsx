/**
 * New Mission Page — First-Run Experience & Guided Video Generation.
 * Provides a streamlined creation path for non-technical CEOs with zero dead-ends.
 *
 * @module app/dashboard/missions/new
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { ensureCustomerOrg } from '@/tree/handover/handover-account-setup';
import { FirstRunWizard } from '@/components/missions/first-run-wizard';
import { Link } from '@/navigation';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return {
    title: isVi ? 'Tạo nhiệm vụ video mới | Sophia AI Factory' : 'New Video Mission | Sophia AI Factory',
    description: isVi
      ? 'Khởi tạo video đầu tiên của bạn với các mẫu tối ưu sẵn và chi phí minh bạch.'
      : 'Launch your first AI video with pre-tested templates and transparent pricing.',
  };
}

export default async function NewMissionPage({ params }: PageProps) {
  const { locale } = await params;
  const isVi = locale === 'vi';

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const d1 = await getD1();
  let workspaceId = '';

  if (d1) {
    // Find workspace or auto-provision default workspace to prevent vacuum dead-ends
    const member = await d1
      .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(user.id)
      .first<{ org_id: string }>();

    if (member?.org_id) {
      workspaceId = member.org_id;
    } else {
      workspaceId = await ensureCustomerOrg(d1, user.id, user.email || user.id);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
      {/* Back to Missions List */}
      <div className="mb-6">
        <Link
          href="/dashboard/missions"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isVi ? 'Quay lại danh sách nhiệm vụ' : 'Back to Missions'}
        </Link>
      </div>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {isVi ? 'Tạo video đầu tiên của bạn' : 'Create Your First Video'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isVi
            ? 'Sophia sẽ tự động soạn kịch bản, lồng tiếng và dựng video hoàn chỉnh theo mẫu bạn chọn.'
            : 'Sophia will autonomously write scripts, synthesize voice, and composite video using your selected template.'}
        </p>
      </div>

      {/* First Run Wizard Component */}
      <FirstRunWizard
        workspaceId={workspaceId}
        userId={user.id}
        locale={isVi ? 'vi' : 'en'}
      />
    </div>
  );
}
