'use client';
/**
 * Error / Empty card view for MissionControlWidget.
 * @module forest/components/dashboard/mission-control/mission-control-empty-error
 */

import { Link } from '@/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';

export function MissionControlErrorCard({
  error,
  isVi,
  retrying,
  onRetry,
}: {
  error: unknown;
  isVi: boolean;
  retrying: boolean;
  onRetry: () => Promise<void>;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-red-400 text-sm mb-3">
        {isVi ? 'Không thể tải dữ liệu điều khiển' : 'Failed to load mission control data'}
      </p>
      <p className="text-muted-foreground text-xs mb-4">
        {error instanceof Error ? error.message : (isVi ? 'Lỗi không xác định' : 'Unknown error')}
      </p>
      <Button onClick={onRetry} disabled={retrying} className="gap-2">
        <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
        {isVi ? 'Thử lại' : 'Retry'}
      </Button>
    </div>
  );
}

export function MissionControlEmptyCard({ isVi }: { isVi: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex flex-col items-center gap-4 py-6">
        <p className="text-muted-foreground text-sm text-center">
          {isVi ? 'Chưa có hoạt động — bắt đầu chiến dịch đầu tiên' : 'No activity yet — start your first campaign'}
        </p>
        <Link
          href="/dashboard/campaigns/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium shadow shadow-primary/20 hover:opacity-90 transition-opacity"
        >
          {isVi ? 'Tạo chiến dịch' : 'Create campaign'}
        </Link>
      </div>
    </div>
  );
}

export function MissionControlSkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 motion-safe:animate-pulse">
      <div className="flex gap-4">
        <div className="h-5 w-20 bg-muted rounded-full" />
        <div className="h-5 w-32 bg-muted rounded" />
        <div className="ml-auto h-8 w-24 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
