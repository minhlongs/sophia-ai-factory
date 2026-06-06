'use client';
/**
 * MissionControlWidget — composite hero card: tier + quota + sparkline + CTA.
 * NEW file — does NOT modify plan-upgrade-widget.tsx (GAP2 scope).
 * @module components/dashboard/mission-control-widget
 */

import { useState } from 'react';
import Link from 'next/link';
import { TierBadge } from './mission-control/tier-badge';
import { RecentActivitySparkline } from './mission-control/recent-activity-sparkline';
import { PrimaryCtaButton } from './mission-control/primary-cta';
import { useMissionControlData } from './mission-control/use-mission-control-data';
import { RefreshCw } from 'lucide-react';

interface MissionControlWidgetProps {
	isVi?: boolean;
}

export function MissionControlWidget({ isVi = false }: MissionControlWidgetProps) {
	const { data, isLoading, error, refetch } = useMissionControlData();
	const [retrying, setRetrying] = useState(false);

	if (isLoading) return <SkeletonCard />;
	if (error || !data) {
		return (
			<div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
				<p className="text-red-400 text-sm mb-3">
					{isVi ? 'Không thể tải dữ liệu điều khiển' : 'Failed to load mission control data'}
				</p>
				<p className="text-zinc-500 text-xs mb-4">
					{error instanceof Error ? error.message : (isVi ? 'Lỗi không xác định' : 'Unknown error')}
				</p>
				<button
					onClick={async () => {
						setRetrying(true);
						await refetch();
						setRetrying(false);
					}}
					disabled={retrying}
					className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-lg text-white transition-colors"
				>
					<RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
					{isVi ? 'Thử lại' : 'Retry'}
				</button>
			</div>
		);
	}

	const quotaPct = data.quota.total > 0 ? (data.quota.used / data.quota.total) * 100 : 0;
	const weeklyTotal = data.last7d.reduce((a, b) => a + b.count, 0);

	return (
		<div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				{/* Left: tier + quota */}
				<div className="flex flex-col gap-3 min-w-0">
					<div className="flex items-center gap-2">
						<TierBadge tier={data.tier} href="/dashboard/billing" />
						<span className="text-zinc-500 text-xs">
							{isVi ? 'Gói hiện tại' : 'Current plan'}
						</span>
					</div>

					<div>
						<div className="flex items-center justify-between mb-1">
							<span className="text-xs text-zinc-400">
								{isVi ? 'Hạn mức MCU' : 'MCU quota'}
							</span>
							<Link href="/dashboard/billing" className="text-xs text-violet-400 hover:underline">
								<span className="tabular-nums">{data.quota.used.toLocaleString()} / {data.quota.total.toLocaleString()}</span>
							</Link>
						</div>
						<div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden w-48 max-w-full">
							<div
								className={`h-full rounded-full transition-all ${quotaPct > 95 ? 'bg-red-500' : quotaPct > 80 ? 'bg-amber-500' : 'bg-violet-500'}`}
								style={{ width: `${Math.min(quotaPct, 100)}%` }}
							/>
						</div>
					</div>
				</div>

				{/* Center: sparkline */}
				<div className="flex flex-col items-start sm:items-center gap-1">
					<RecentActivitySparkline data={data.last7d} />
					<span className="text-xs text-zinc-500">
						{weeklyTotal} {isVi ? 'calls / 7 ngày' : 'calls / 7d'}
					</span>
				</div>

				{/* Right: CTA */}
				<div>
					<PrimaryCtaButton ctaHint={data.ctaHint} isVi={isVi} />
				</div>
			</div>
		</div>
	);
}

function SkeletonCard() {
	return (
		<div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 motion-safe:animate-pulse">
			<div className="flex gap-4">
				<div className="h-5 w-20 bg-zinc-800 rounded-full" />
				<div className="h-5 w-32 bg-zinc-800 rounded" />
				<div className="ml-auto h-8 w-24 bg-zinc-800 rounded-lg" />
			</div>
		</div>
	);
}
