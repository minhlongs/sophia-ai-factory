import type { Metadata } from 'next';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getCustomerHealthSummary } from '@/land/production-monitoring/customer-health-summary';
import { CustomerHealthDashboard } from '@/components/system-health/customer-health-dashboard';
import { Link } from '@/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return {
    title: isVi ? 'Trạng thái Hệ thống | Sophia AI' : 'System Health | Sophia AI',
    description: isVi
      ? 'Kiểm tra trạng thái sẵn sàng của Sophia và hướng dẫn xử lý sự cố.'
      : 'Review operational readiness of Sophia and actionable incident recovery.',
  };
}

export default async function CustomerHealthPage({ params }: PageProps) {
  const { locale } = await params;
  const isVi = locale === 'vi';
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-foreground">
            {isVi ? 'Yêu cầu đăng nhập' : 'Authentication Required'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isVi
              ? 'Vui lòng đăng nhập để xem trạng thái hệ thống dành riêng cho tài khoản của bạn.'
              : 'Please sign in to view the system health status for your account.'}
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {isVi ? 'Đăng nhập ngay' : 'Sign In'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const health = await getCustomerHealthSummary(user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <CustomerHealthDashboard
        initialHealth={health}
        locale={locale === 'en' ? 'en' : 'vi'}
      />
    </div>
  );
}
